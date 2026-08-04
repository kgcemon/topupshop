import { prisma } from "@/lib/prisma";
import { SecretField } from "@/components/secret-field";
import {
  createSmsSenderAction,
  updateSmsSenderAction,
  toggleSmsSenderActiveAction,
  deleteSmsSenderAction,
  regeneratePaymentSmsSecretAction,
  updateBalanceVerifySettingsAction,
} from "@/lib/actions/sms-sender-actions";

const METHOD_LABELS: Record<string, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function AdminSmsSettingsPage() {
  const [senders, siteSetting] = await Promise.all([
    prisma.smsSender.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.siteSetting.findUnique({
      where: { id: 1 },
      select: {
        paymentSmsSecret: true,
        paymentSmsBalanceVerifyEnabled: true,
        bkashBalanceCheckpoint: true,
        nagadBalanceCheckpoint: true,
        rocketBalanceCheckpoint: true,
      },
    }),
  ]);
  const secret = siteSetting?.paymentSmsSecret ?? null;
  const webhookUrl = secret ? `${SITE_URL}/api/payment-sms?secret=${secret}` : null;
  const balanceVerifyEnabled = siteSetting?.paymentSmsBalanceVerifyEnabled ?? false;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-1 text-lg font-bold">Webhook URL</h1>
        <p className="mb-4 text-xs text-gray-500">
          মোবাইল SMS-forwarder অ্যাপে এই URL টি সেট করুন। এই secret ছাড়া কেউ ভুয়া পেমেন্ট SMS পাঠিয়ে ব্যালেন্স
          যোগ করতে পারবে না — তাই এটি গোপন রাখুন।
        </p>
        {webhookUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <SecretField value={webhookUrl} />
            </div>
            <form action={regeneratePaymentSmsSecretAction}>
              <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                Rotate Secret
              </button>
            </form>
          </div>
        ) : (
          <form action={regeneratePaymentSmsSecretAction}>
            <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
              Generate Webhook Secret
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-1 text-lg font-bold">Balance Verify</h1>
        <p className="mb-4 text-xs text-gray-500">
          Enable করলে প্রতিটি নতুন Payment SMS-এর balance যাচাই করা হবে — আগের checkpoint balance + নতুন amount =
          SMS-এ থাকা balance কিনা। না মিললে SMS টি Store SMS list-এ যোগ হবে কিন্তু disabled অবস্থায় থাকবে (auto-match
          হবে না) এবং আপনি notification পাবেন।
        </p>
        <form action={updateBalanceVerifySettingsAction} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="enabled" value="true" defaultChecked={balanceVerifyEnabled} className="h-4 w-4" />
            Balance Verify Enable করুন
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">bKash Checkpoint Balance</label>
              <input
                name="bkashBalanceCheckpoint"
                type="number"
                step="0.01"
                placeholder="বর্তমান balance"
                defaultValue={siteSetting?.bkashBalanceCheckpoint?.toString() ?? ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Nagad Checkpoint Balance</label>
              <input
                name="nagadBalanceCheckpoint"
                type="number"
                step="0.01"
                placeholder="বর্তমান balance"
                defaultValue={siteSetting?.nagadBalanceCheckpoint?.toString() ?? ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Rocket Checkpoint Balance</label>
              <input
                name="rocketBalanceCheckpoint"
                type="number"
                step="0.01"
                placeholder="বর্তমান balance"
                defaultValue={siteSetting?.rocketBalanceCheckpoint?.toString() ?? ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            খালি রাখলে সেই method-এর checkpoint reset হয়ে যাবে — পরের SMS থেকে নতুন করে baseline সেট হবে।
          </p>

          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            Save
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-1 text-lg font-bold">SMS Sender Settings</h1>
        <p className="mb-4 text-xs text-gray-500">
          মোবাইল অ্যাপ থেকে পাঠানো Payment SMS-এর sender এই লিস্টের সাথে মিললেই তা "Matched" হিসেবে গণ্য হবে।
        </p>
        <form action={createSmsSenderAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Sender Name</label>
            <input
              name="name"
              required
              placeholder="e.g. bKash"
              className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Method</label>
            <select name="method" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="ROCKET">Rocket</option>
            </select>
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {senders.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white py-8 text-center text-sm text-gray-500">
            কোনো Sender যোগ করা হয়নি।
          </p>
        )}
        {senders.map((sender) => (
          <div key={sender.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{sender.name}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  {METHOD_LABELS[sender.method] ?? sender.method}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    sender.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {sender.isActive ? "Active" : "Disabled"}
                </span>
                <form action={toggleSmsSenderActiveAction}>
                  <input type="hidden" name="id" value={sender.id} />
                  <input type="hidden" name="isActive" value={String(sender.isActive)} />
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                    {sender.isActive ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteSmsSenderAction}>
                  <input type="hidden" name="id" value={sender.id} />
                  <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-bold text-primary-600">Edit</summary>
              <form action={updateSmsSenderAction} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={sender.id} />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold">Sender Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={sender.name}
                    className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold">Method</label>
                  <select
                    name="method"
                    defaultValue={sender.method}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="ROCKET">Rocket</option>
                  </select>
                </div>
                <button className="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-600">
                  Save
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
