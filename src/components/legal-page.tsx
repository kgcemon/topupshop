export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-3 py-8 md:px-4 md:py-14">
      <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-10">
        <h1 className="mb-2 font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">{title}</h1>
        {updatedAt && <p className="mb-6 text-xs text-gray-400">সর্বশেষ আপডেট: {updatedAt}</p>}
        <div
          className="space-y-4 text-sm leading-relaxed text-gray-700
            [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-primary [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-secondary-900
            [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
            [&_a]:font-semibold [&_a]:text-primary-600 [&_a]:hover:underline"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
