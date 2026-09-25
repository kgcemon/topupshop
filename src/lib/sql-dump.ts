import { prisma } from "@/lib/prisma";

// A self-contained mysqldump written in JS on top of Prisma's raw query API.
//
// Shelling out to the real `mysqldump` would be less code, but the binary
// isn't installed on most shared/VPS Node hosts (and never matches the server
// version on Windows dev machines), so the backup would silently only work on
// some deployments. Everything here goes through the same pooled connection
// the app already uses.

const ROW_CHUNK = 500; // rows fetched per round trip
const MAX_INSERT_BYTES = 512 * 1024; // flush an INSERT once its SQL reaches this size

type Row = Record<string, unknown>;

function quoteIdent(name: string) {
  // Backticks are the only character that needs escaping inside `...`.
  return "`" + name.replace(/`/g, "``") + "`";
}

// Mirrors mysql_real_escape_string for the characters that matter inside a
// single-quoted literal on a utf8mb4 connection.
const STRING_ESCAPES: Record<string, string> = {
  "\0": "\\0",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\r": "\\r",
  "\x1a": "\\Z",
  '"': '\\"',
  "'": "\\'",
  "\\": "\\\\",
};

function escapeString(value: string) {
  return "'" + value.replace(/[\0\b\t\n\r\x1a"'\\]/g, (char) => STRING_ESCAPES[char]) + "'";
}

function toHexLiteral(bytes: Uint8Array) {
  // `0x` with no digits is a syntax error, so an empty BLOB has to be '' instead.
  if (bytes.byteLength === 0) return "''";
  return "0x" + Buffer.from(bytes).toString("hex");
}

const NUMERIC_TEXT = /^-?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i;

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return escapeString(value);
  if (value instanceof Date) {
    // Prisma stores DATETIME(3) in UTC, so the literal has to be UTC too.
    return Number.isNaN(value.getTime()) ? "NULL" : escapeString(value.toISOString().slice(0, 23).replace("T", " "));
  }
  if (value instanceof Uint8Array) return toHexLiteral(value);
  if (Buffer.isBuffer(value)) return toHexLiteral(value);

  // JSON columns (Product.rules, MarketListing.images): the MariaDB driver
  // parses them into real arrays/objects, so they have to be re-serialised —
  // String() on them would write the literal text "[object Object]".
  const text = String(value);
  if (Array.isArray(value) || text === "[object Object]") {
    return escapeString(JSON.stringify(value));
  }

  // Decimal (the driver may hand back a Decimal-like object) and anything else
  // with a sane toString: emit numbers bare, everything else as a quoted string.
  if (NUMERIC_TEXT.test(text)) return text;
  return escapeString(text);
}

type TableInfo = { name: string; isView: boolean };

async function listTables(): Promise<TableInfo[]> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string; TABLE_TYPE: string }[]>(
    "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
  );
  return rows.map((row) => ({
    name: String(row.TABLE_NAME),
    isView: String(row.TABLE_TYPE).toUpperCase() !== "BASE TABLE",
  }));
}

async function getCreateStatement(table: string, isView: boolean) {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SHOW CREATE ${isView ? "VIEW" : "TABLE"} ${quoteIdent(table)}`
  );
  const row = rows[0];
  if (!row) return null;
  // The DDL column is "Create Table" / "Create View" — take the first value
  // that actually looks like a CREATE statement instead of hard-coding either.
  const ddl = Object.values(row).find((value) => typeof value === "string" && /^\s*CREATE/i.test(value));
  return typeof ddl === "string" ? ddl : null;
}

// Single-column primary key, if the table has one. Used for keyset pagination:
// LIMIT/OFFSET would skip or duplicate rows whenever the site writes to the
// table mid-dump, which for an order/wallet table is exactly when it matters.
async function getSingleColumnPrimaryKey(table: string) {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    table
  );
  return rows.length === 1 ? String(rows[0].COLUMN_NAME) : null;
}

function buildInsertPrefix(table: string, columns: string[]) {
  return `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES\n`;
}

/**
 * Streams a full `DROP TABLE` + `CREATE TABLE` + `INSERT` dump of the current
 * database. Yielded in chunks so the caller can gzip it without ever holding
 * the whole uncompressed dump in memory.
 */
export async function* streamSqlDump(): AsyncGenerator<string> {
  const generatedAt = new Date().toISOString();
  const [{ db } = { db: "unknown" }] = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "SELECT DATABASE() AS db"
  );

  yield [
    `-- topupshop database backup`,
    `-- database: ${db}`,
    `-- generated: ${generatedAt}`,
    ``,
    `/*!40101 SET NAMES utf8mb4 */;`,
    `SET FOREIGN_KEY_CHECKS = 0;`,
    `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';`,
    `SET time_zone = '+00:00';`,
    ``,
    ``,
  ].join("\n");

  const tables = await listTables();

  for (const table of tables) {
    const ddl = await getCreateStatement(table.name, table.isView);
    if (!ddl) continue;

    yield `--\n-- ${table.isView ? "View" : "Table"} ${table.name}\n--\n\n`;
    yield `DROP ${table.isView ? "VIEW" : "TABLE"} IF EXISTS ${quoteIdent(table.name)};\n`;
    yield `${ddl};\n\n`;

    // A view has no rows of its own — its SELECT re-derives them on restore.
    if (table.isView) continue;

    const primaryKey = await getSingleColumnPrimaryKey(table.name);
    let cursor: unknown = null;
    let wroteAny = false;
    let buffer = "";
    let prefix = "";
    let rowsInStatement = 0;

    for (;;) {
      const rows: Row[] = primaryKey
        ? await prisma.$queryRawUnsafe<Row[]>(
            cursor === null
              ? `SELECT * FROM ${quoteIdent(table.name)} ORDER BY ${quoteIdent(primaryKey)} LIMIT ${ROW_CHUNK}`
              : `SELECT * FROM ${quoteIdent(table.name)} WHERE ${quoteIdent(primaryKey)} > ? ORDER BY ${quoteIdent(primaryKey)} LIMIT ${ROW_CHUNK}`,
            ...(cursor === null ? [] : [cursor])
          )
        : // No usable primary key (join tables with a composite key): one shot,
          // which is consistent as long as the table fits in memory.
          await prisma.$queryRawUnsafe<Row[]>(`SELECT * FROM ${quoteIdent(table.name)}`);

      if (rows.length === 0) break;

      for (const row of rows) {
        const columns = Object.keys(row);
        if (!prefix) prefix = buildInsertPrefix(table.name, columns);
        const tuple = `(${columns.map((column) => escapeValue(row[column])).join(", ")})`;

        if (rowsInStatement === 0) {
          buffer += prefix + tuple;
        } else {
          buffer += ",\n" + tuple;
        }
        rowsInStatement += 1;
        wroteAny = true;

        if (buffer.length >= MAX_INSERT_BYTES) {
          yield buffer + ";\n";
          buffer = "";
          rowsInStatement = 0;
        }
      }

      if (!primaryKey || rows.length < ROW_CHUNK) break;
      cursor = rows[rows.length - 1][primaryKey];
      // A NULL primary key is impossible, but a missing column would loop forever.
      if (cursor === null || cursor === undefined) break;
    }

    if (rowsInStatement > 0) yield buffer + ";\n";
    if (wroteAny) yield "\n";
  }

  yield `SET FOREIGN_KEY_CHECKS = 1;\n-- backup complete\n`;
}
