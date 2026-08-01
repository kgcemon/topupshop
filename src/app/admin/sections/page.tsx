import { prisma } from "@/lib/prisma";
import { SectionForm } from "@/components/section-form";
import {
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  toggleSectionActiveAction,
} from "@/lib/actions/admin-actions";

export default async function AdminSectionsPage() {
  const sections = await prisma.section.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Add Section</h1>
        <SectionForm action={createSectionAction} submitLabel="+ Add Section" />
      </div>

      <div className="space-y-3">
        {sections.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            এখনো কোনো section যোগ করা হয়নি।
          </p>
        )}
        {sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-bold">{section.name}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {section._count.products} products
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    section.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {section.isActive ? "Active" : "Hidden"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleSectionActiveAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="isActive" value={String(section.isActive)} />
                  <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                    {section.isActive ? "Hide" : "Show"}
                  </button>
                </form>
                <form action={deleteSectionAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <button
                    disabled={section._count.products > 0}
                    title={
                      section._count.products > 0
                        ? "এই section এ প্রোডাক্ট থাকায় ডিলিট করা যাবে না"
                        : undefined
                    }
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
            <SectionForm
              action={updateSectionAction}
              submitLabel="Save"
              defaultValues={{
                id: section.id,
                name: section.name,
                slug: section.slug,
                sortOrder: section.sortOrder,
                isActive: section.isActive,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
