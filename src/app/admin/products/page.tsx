import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { toggleProductActiveAction, toggleProductStockAction } from "@/lib/actions/admin-actions";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ sectionId: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { rechargeOptions: true } }, section: { select: { name: true } } },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
        >
          + Add Product
        </Link>
      </div>

      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <Image
                src={product.image}
                alt={product.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-md object-cover"
              />
              <div>
                <p className="font-bold">{product.name}</p>
                <p className="text-xs text-gray-500">
                  {product.section.name} · {product.type} · {product._count.rechargeOptions} options
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {product.isActive ? "Active" : "Hidden"}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  product.stockOut ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                }`}
              >
                {product.stockOut ? "Stock Out" : "In Stock"}
              </span>
              <Link
                href={`/admin/products/${product.id}/edit`}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50"
              >
                Edit
              </Link>
              <form action={toggleProductActiveAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="isActive" value={String(product.isActive)} />
                <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                  {product.isActive ? "Hide" : "Show"}
                </button>
              </form>
              <form action={toggleProductStockAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="stockOut" value={String(product.stockOut)} />
                <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                  {product.stockOut ? "Mark In Stock" : "Mark Stock Out"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
