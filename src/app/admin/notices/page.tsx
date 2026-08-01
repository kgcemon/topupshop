import { prisma } from "@/lib/prisma";
import { createNoticeAction, toggleNoticeActiveAction } from "@/lib/actions/admin-actions";
import { BroadcastNotificationForm } from "@/components/broadcast-notification-form";

export default async function AdminNoticesPage() {
  const notices = await prisma.notice.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-1 text-lg font-bold">Notify All Users</h1>
        <p className="mb-4 text-xs text-gray-500">
          এটি প্রতিটি ইউজারের নোটিফিকেশন বেলে পাঠানো হবে (Notice Bar থেকে আলাদা, যা সাইটে সবার জন্য একটি ব্যানার হিসেবে দেখায়)।
        </p>
        <BroadcastNotificationForm />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Notice Bar</h1>
        <form action={createNoticeAction} className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold">Message</label>
            <input name="message" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add Notice
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {notices.map((notice) => (
          <div key={notice.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm">{notice.message}</p>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${notice.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {notice.isActive ? "Active" : "Hidden"}
              </span>
              <form action={toggleNoticeActiveAction}>
                <input type="hidden" name="id" value={notice.id} />
                <input type="hidden" name="isActive" value={String(notice.isActive)} />
                <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                  {notice.isActive ? "Hide" : "Show"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
