import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { createBannerAction, deleteBannerAction, toggleBannerActiveAction } from "@/lib/actions/admin-actions";

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Homepage Banners</h1>
        <form action={createBannerAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Banner ইমেজ আপলোড</label>
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              required
              className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-primary-500 file:px-2 file:py-1 file:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Link (optional)</label>
            <input name="link" className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add Banner
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {banners.map((banner) => (
          <div key={banner.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <Image src={banner.image} alt="Banner" width={120} height={40} className="h-10 w-32 rounded object-cover" />
              <span className="text-xs text-gray-500">{banner.image}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${banner.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {banner.isActive ? "Active" : "Hidden"}
              </span>
              <form action={toggleBannerActiveAction}>
                <input type="hidden" name="id" value={banner.id} />
                <input type="hidden" name="isActive" value={String(banner.isActive)} />
                <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                  {banner.isActive ? "Hide" : "Show"}
                </button>
              </form>
              <form action={deleteBannerAction}>
                <input type="hidden" name="id" value={banner.id} />
                <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
