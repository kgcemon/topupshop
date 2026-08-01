import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-primary text-6xl font-bold text-secondary-900">404</p>
      <p className="mt-2 text-lg font-semibold">পেজটি খুঁজে পাওয়া যায়নি।</p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary-500 px-5 py-2 font-bold text-white hover:bg-primary-600"
      >
        হোমপেজে ফিরে যান
      </Link>
    </div>
  );
}
