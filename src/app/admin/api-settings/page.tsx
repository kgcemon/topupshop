import { prisma } from "@/lib/prisma";
import { SecretField } from "@/components/secret-field";
import {
  createApiSettingAction,
  toggleApiSettingActiveAction,
  deleteApiSettingAction,
} from "@/lib/actions/api-settings-actions";

const TYPE_LABELS: Record<string, string> = {
  UNIPIN: "Unipin",
  GARENA_SHELL: "Garena Shell",
  OTHER: "Other",
};

export default async function AdminApiSettingsPage() {
  const settings = await prisma.apiSetting.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-4 text-lg font-bold">API Settings</h1>
        <form action={createApiSettingAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Unipin Live"
              className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Type</label>
            <select name="type" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="UNIPIN">Unipin</option>
              <option value="GARENA_SHELL">Garena Shell</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">API Key</label>
            <input name="apiKey" className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">API Secret</label>
            <input name="apiSecret" className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Endpoint</label>
            <input
              name="endpoint"
              placeholder="https://..."
              className="w-52 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {settings.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white py-8 text-center text-sm text-gray-500">
            কোনো API সেটিং যোগ করা হয়নি।
          </p>
        )}
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{setting.name}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  {TYPE_LABELS[setting.type] ?? setting.type}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    setting.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {setting.isActive ? "Active" : "Disabled"}
                </span>
                <form action={toggleApiSettingActiveAction}>
                  <input type="hidden" name="id" value={setting.id} />
                  <input type="hidden" name="isActive" value={String(setting.isActive)} />
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                    {setting.isActive ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteApiSettingAction}>
                  <input type="hidden" name="id" value={setting.id} />
                  <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-3">
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">API Key</p>
                <SecretField value={setting.apiKey} />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">API Secret</p>
                <SecretField value={setting.apiSecret} />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-gray-500">Endpoint</p>
                <p className="truncate font-mono text-xs">{setting.endpoint || "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
