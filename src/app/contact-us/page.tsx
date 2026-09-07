import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "topupshop.co সাপোর্ট টিমের সাথে WhatsApp, Telegram, Messenger বা ইমেইলে যোগাযোগ করুন।",
  alternates: { canonical: "/contact-us" },
};

export default async function ContactUsPage() {
  const settings = await getSiteSettings();

  const items = [
    {
      href: `tel:+88${settings.whatsappNumber}`,
      label: "আমাদের সাথে সরাসরি কথা বলতে এখানে ক্লিক করুন।",
      color: "#2563eb",
      icon: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      ),
    },
    {
      href: "https://m.me/ucghor",
      label: "মেসেঞ্জারে লাইভ চ্যাটের জন্য এখানে ক্লিক করুন।",
      color: "#EF3F80",
      icon: (
        <path d="M12 2C6.48 2 2 6.15 2 11.26c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.86.38 2.92.38 5.52 0 10-4.15 10-9.26S17.52 2 12 2Zm1.02 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.6 2.72 4.93-2.72-5.48 5.82Z" />
      ),
    },
    {
      href: `https://wa.me/88${settings.whatsappNumber}`,
      label: "হোয়াটসঅ্যাপে লাইভ চ্যাটের জন্য এখানে ক্লিক করুন।",
      color: "#25D366",
      icon: (
        <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.34A10 10 0 1 0 12 2Zm5.8 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.11-1.26.2-3.68-.79-3.09-1.28-5.08-4.42-5.23-4.63-.15-.2-1.25-1.66-1.25-3.17s.79-2.25 1.07-2.56c.28-.3.6-.38.8-.38h.58c.19 0 .43-.04.68.51.25.55.85 1.9.93 2.04.08.15.13.32.02.52-.11.2-.16.32-.32.5-.16.18-.34.4-.49.54-.16.15-.33.32-.14.63.19.31.85 1.4 1.83 2.27 1.26 1.12 2.32 1.47 2.63 1.63.31.16.49.13.68-.08.19-.21.79-.92 1-1.23.21-.31.42-.26.7-.16.28.1 1.79.85 2.1 1 .31.16.51.23.58.36.08.13.08.75-.17 1.45Z" />
      ),
    },
    {
      href: settings.telegramLink,
      label: "টেলিগ্রাম সাপোর্টে কথা বলার জন্য এখানে ক্লিক করুন।",
      color: "#0088cc",
      icon: (
        <path d="M21.05 3.79 2.6 10.98c-1.24.5-1.23 1.2-.23 1.5l4.72 1.47 1.82 5.53c.22.6.37.84.75.84.38 0 .55-.17.75-.38l1.8-1.75 4.75 3.5c.87.48 1.5.23 1.72-.8L22 5.06c.3-1.26-.48-1.83-1.95-1.27Z" />
      ),
    },
    {
      href: `mailto:${settings.contactEmail}`,
      label: "আমাদের সাপোর্টে ইমেইল করতে এখানে ক্লিক করুন।",
      color: "#f59e0b",
      icon: (
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 6-10 7L2 6" />
        </>
      ),
      stroke: true,
    },
  ];

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center font-primary text-3xl font-bold text-secondary-900">
          Contact Us
        </h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-4 transition-shadow hover:shadow-md"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={item.stroke ? "none" : item.color}
                stroke={item.stroke ? item.color : undefined}
                strokeWidth={item.stroke ? 2 : undefined}
                className="h-6 w-6 shrink-0"
              >
                {item.icon}
              </svg>
              <span className="text-sm font-semibold">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
