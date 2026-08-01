import Link from "next/link";
import Image from "next/image";

type Product = {
  id: number;
  name: string;
  slug: string;
  image: string;
  type: "NORMAL" | "EXTERNAL_LINK";
  externalUrl: string | null;
  stockOut: boolean;
};

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 md:gap-8">
      {products.map((product) => {
        const href =
          product.type === "EXTERNAL_LINK" && product.externalUrl
            ? product.externalUrl
            : `/topup/${product.id}/${product.slug}`;
        const isExternal = product.type === "EXTERNAL_LINK";

        const image = (
          <div className="relative">
            <Image
              src={product.image}
              alt={product.name}
              width={100}
              height={100}
              sizes="(min-width: 768px) 100px, 33vw"
              className={`mx-auto aspect-square w-full max-w-[100px] rounded-md object-cover ${
                product.stockOut ? "blur-[1px] grayscale opacity-60" : ""
              }`}
            />
            {product.stockOut && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-gray-900/80 px-2 py-1 text-[10px] font-bold text-white">
                  Stock Out
                </span>
              </span>
            )}
          </div>
        );

        return (
          <div key={product.id} className="mb-2 md:mb-6">
            {product.stockOut ? (
              <div className="block cursor-not-allowed">
                {image}
                <p className="mt-2 text-center text-sm font-semibold text-gray-400">{product.name}</p>
              </div>
            ) : (
              <Link
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="block"
              >
                {image}
                <p className="mt-2 text-center text-sm font-semibold">{product.name}</p>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
