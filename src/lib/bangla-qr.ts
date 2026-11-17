import type { Prisma } from "@/generated/prisma/client";

// Bangla QR (bKash -> bank merchant QR) payments.
//
// Below the admin's bKash minimum amount the customer can be shown a Bangla QR
// instead of the bKash number. They pay it from the bKash app ("QR Scan" ->
// pick the downloaded QR from the gallery) and then type the bKash number they
// paid FROM. The bank (BANK.ASIA) then sends an SMS like
//
//   MD X received Bangla QR Payment Tk.11,064.00 successfully from
//   018577**4589, APPROVAL CODE 590099, 12/11/26 22:22
//
// which the SMS forwarder posts to /api/payment-sms. There is no trx id the
// customer could type, so the match is made on:
//   - the exact amount,
//   - the payer number (the SMS masks the middle: first 6 + last 4 digits),
//   - and time: SMS and order/deposit must be within MATCH_WINDOW_MS.
// Because that is weaker than a trx id, anything ambiguous (more than one SMS
// or more than one pending request fitting) is never auto-approved — it is
// left for the admin.

export const BANGLA_QR_MATCH_WINDOW_MS = 5 * 60 * 1000;

export type BkashMinMode = "OFF" | "WARNING" | "BANGLA_QR";

export function normalizeBkashMinMode(value: string | null | undefined): BkashMinMode {
  return value === "OFF" || value === "BANGLA_QR" ? value : "WARNING";
}

/** Below-minimum Bangla QR is live only with an amount, the mode on, and a QR image to show. */
export function isBanglaQrActive(settings: {
  bkashMinAmount: number;
  bkashMinMode: string;
  banglaQrImage: string | null;
}) {
  return settings.bkashMinAmount > 0 && settings.bkashMinMode === "BANGLA_QR" && !!settings.banglaQrImage;
}

/** "01857714589", "+8801857714589", "01857-714589" -> "01857714589"; null when not a BD mobile number. */
export function normalizeBdMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  else if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/**
 * Does the full number the customer typed fit the bank's masked one
 * ("018577**4589")? Compares the first 6 and the last 4 digits.
 */
export function maskedNumberMatches(masked: string, full: string): boolean {
  const m = masked.match(/^(\d{6})\d*\*+\d*?(\d{4})$/);
  if (!m) return false;
  return full.length === 11 && full.slice(0, 6) === m[1] && full.slice(-4) === m[2];
}

/** YouTube watch/short/share/embed URL -> video id (null when not recognisable). */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export type ParsedBanglaQrSms = {
  amount: string;
  paymentNumber: string;
  trxId: string;
};

/**
 * BANK.ASIA Bangla QR credit SMS. The approval code alone can repeat over
 * time, so the stored trx id also carries the SMS's own date/time — that pair
 * is unique per payment and lets a re-forwarded duplicate be recognised.
 */
export function parseBanglaQrSms(sms: string): ParsedBanglaQrSms | null {
  const text = sms.replace(/\s+/g, " ");
  const m = text.match(
    /received Bangla QR Payment Tk\.?\s*([\d,]+(?:\.\d{1,2})?) successfully from ([\d*]{8,15}),? APPROVAL CODE (\w+),? (\d{1,2})\/(\d{1,2})\/(\d{2,4}) (\d{1,2}):(\d{2})/i
  );
  if (!m) return null;
  const [, amount, from, approval, d, mo, y, h, mi] = m;
  const stamp = `${d.padStart(2, "0")}${mo.padStart(2, "0")}${y.slice(-2)}${h.padStart(2, "0")}${mi}`;
  return {
    amount: amount.replace(/,/g, ""),
    paymentNumber: from,
    trxId: `BQR${approval}T${stamp}`,
  };
}

/**
 * Checkout/deposit side: the customer just submitted. Find the one unused
 * BANGLA_QR SMS that fits (amount, number, arrived within the window). Returns
 * null when none or more than one fits — the request then waits as PENDING.
 */
export async function findBanglaQrSmsForPayer(
  tx: Prisma.TransactionClient,
  params: { payerNumber: string; amount: number; at: Date }
) {
  const candidates = await tx.paymentSms.findMany({
    where: {
      method: "BANGLA_QR",
      status: "UNUSED",
      isActive: true,
      amount: params.amount,
      createdAt: {
        gte: new Date(params.at.getTime() - BANGLA_QR_MATCH_WINDOW_MS),
        lte: new Date(params.at.getTime() + BANGLA_QR_MATCH_WINDOW_MS),
      },
    },
    take: 10,
  });
  const fitting = candidates.filter((c) => maskedNumberMatches(c.paymentNumber, params.payerNumber));
  return fitting.length === 1 ? { sms: fitting[0], ambiguous: false } : { sms: null, ambiguous: fitting.length > 1 };
}
