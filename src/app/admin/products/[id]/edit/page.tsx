import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/product-form";
import {
  updateProductAction,
  addRechargeOptionAction,
  deleteRechargeOptionAction,
  updateRechargeOptionStockAction,
  updateRechargeOptionDenomAction,
} from "@/lib/actions/admin-actions";
import { formatTaka } from "@/lib/utils";
import { getAllSections } from "@/lib/data";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  const [product, sections] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: { rechargeOptions: { orderBy: { sortOrder: "asc" } } },
    }),
    getAllSections(),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Edit Product: {product.name}</h1>
        <ProductForm
          action={updateProductAction}
          submitLabel="Save Changes"
          sections={sections}
          defaultValues={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.image,
            sectionId: product.sectionId,
            type: product.type,
            externalUrl: product.externalUrl,
            category: product.category,
            description: product.description,
            rules: Array.isArray(product.rules) ? (product.rules as string[]) : [],
            isActive: product.isActive,
            stockOut: product.stockOut,
            sortOrder: product.sortOrder,
          }}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Recharge Options</h2>
        <div className="mb-4 space-y-2">
          {product.rechargeOptions.map((option) => {
            const outOfStock = option.stock !== null && option.stock <= 0;
            return (
              <div key={option.id} className="space-y-2 rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold">{option.label}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{formatTaka(option.price)} TK</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        option.stock === null
                          ? "bg-gray-100 text-gray-600"
                          : outOfStock
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {option.stock === null ? "Unlimited" : outOfStock ? "Stock Out" : `Stock: ${option.stock}`}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        option.denom ? "bg-primary-50 text-primary-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {option.denom ? `Denom: ${option.denom}` : "Denom নেই"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <form action={updateRechargeOptionStockAction} className="flex items-center gap-1">
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      placeholder="Unlimited"
                      defaultValue={option.stock ?? ""}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button className="rounded-md border border-gray-300 px-2 py-1 text-xs font-bold hover:bg-gray-50">
                      Update Stock
                    </button>
                  </form>
                  <form action={updateRechargeOptionDenomAction} className="flex items-center gap-1">
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      name="denom"
                      placeholder="e.g. 4,4,5"
                      defaultValue={option.denom ?? ""}
                      className="w-36 rounded-md border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button className="rounded-md border border-gray-300 px-2 py-1 text-xs font-bold hover:bg-gray-50">
                      Update Denom
                    </button>
                  </form>
                  <form action={deleteRechargeOptionAction}>
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {product.rechargeOptions.length === 0 && (
            <p className="text-sm text-gray-500">এখনো কোনো recharge option যোগ করা হয়নি।</p>
          )}
        </div>

        <form action={addRechargeOptionAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <label className="mb-1 block text-xs font-semibold">Label</label>
            <input
              name="label"
              required
              placeholder="e.g. 115 Diamond"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Price (TK)</label>
            <input
              name="price"
              type="number"
              required
              min={0}
              className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Stock (blank = unlimited)</label>
            <input
              name="stock"
              type="number"
              min={0}
              placeholder="Unlimited"
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Unipin Denom(s), comma-separated</label>
            <input
              name="denom"
              placeholder="e.g. 4,4,5"
              className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600">
            + Add Option
          </button>
        </form>
      </div>
    </div>
  );
}
