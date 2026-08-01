import { ProductForm } from "@/components/product-form";
import { createProductAction } from "@/lib/actions/admin-actions";
import { getAllSections } from "@/lib/data";

export default async function NewProductPage() {
  const sections = await getAllSections();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="mb-4 text-lg font-bold">Add Product</h1>
      <ProductForm action={createProductAction} submitLabel="Create Product" sections={sections} />
    </div>
  );
}
