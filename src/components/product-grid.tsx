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
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 md:gap-8 md:px-0 md:py-5">
      {products.map((product) => {
        const href =
          product.type === "EXTERNAL_LINK" && product.externalUrl
            ? product.externalUrl
            : `/topup/${product.id}/${product.slug}`;
        const isExternal = product.type === "EXTERNAL_LINK";

        const media = (
          <div className="cursor-pointer">
            <div className="transform transition duration-300 hover:scale-90">
              <div className="mx-auto h-full w-full text-center">
                <div className="relative mx-auto h-[100px] w-[100px] overflow-hidden rounded-md">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={100}
                    height={100}
                    sizes="100px"
                    className={`mx-auto h-[100px] w-[100px] object-contain ${
                      product.stockOut ? "opacity-60 blur-[1px] grayscale" : ""
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
              </div>
            </div>
          </div>
        );

        const caption = (
          <p
            className={`text-center font-primary text-xs font-extralight capitalize pt-3 ${
              product.stockOut ? "text-gray-400" : "text-secondary-900"
            }`}
          >
            {product.name}
          </p>
        );

        return (
          <div key={product.id} className="single-game-product mb-2 md:mb-6">
            {product.stockOut ? (
              <div className="block cursor-not-allowed">
                {media}
                {caption}
              </div>
            ) : (
              <Link
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="block"
              >
                {media}
                {caption}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
