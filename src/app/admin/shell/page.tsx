import { prisma } from "@/lib/prisma";
import { SecretField } from "@/components/secret-field";
import { CopyButton } from "@/components/copy-button";
import { createShellAccountAction, deleteShellAccountAction } from "@/lib/actions/shell-actions";

export default async function AdminShellPage() {
  const accounts = await prisma.garenaShellAccount.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-4 text-lg font-bold">Garena Shell অ্যাকাউন্ট</h1>
        <form action={createShellAccountAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Label</label>
            <input
              name="label"
              required
              placeholder="e.g. Main Account"
              className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Account ID</label>
            <input name="accountId" required className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Password</label>
            <input name="password" required className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Code (optional)</label>
            <input name="code" className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Server (optional)</label>
            <input name="server" className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {accounts.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white py-8 text-center text-sm text-gray-500">
            কোনো Garena Shell অ্যাকাউন্ট যোগ করা হয়নি।
          </p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-bold">{account.label}</p>
              <form action={deleteShellAccountAction}>
                <input type="hidden" name="id" value={account.id} />
                <button className="shrink-0 rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </form>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">Account ID</p>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-xs">{account.accountId}</span>
                  <CopyButton value={account.accountId} label="" />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">Password</p>
                <SecretField value={account.password} />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">Code</p>
                <SecretField value={account.code} />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">Server</p>
                <p className="truncate font-mono text-xs">{account.server || "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
