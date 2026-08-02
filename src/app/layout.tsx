import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Bree_Serif } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HelpBubble } from "@/components/help-bubble";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PwaRegister } from "@/components/pwa-register";
import { getSiteSettings } from "@/lib/data";

const bodyFont = Hind_Siliguri({
  variable: "--font-body",
  subsets: ["latin", "bengali"],
  weight: ["400", "500", "600", "700"],
});

const headingFont = Bree_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: "#14d72b",
};

const DEFAULT_DESCRIPTION =
  "TopUpsBD থেকে সবচেয়ে দ্রুত ও নিরাপদভাবে Free Fire Diamond TopUp করুন। UID Topup, Weekly/Monthly Membership, Level Up Pass — ২৪ ঘন্টা সার্ভিস।";
const DEFAULT_KEYWORDS = [
  "Free Fire Topup",
  "Free Fire Diamond",
  "TopUpsBD",
  "Free Fire BD Server Topup",
  "Free Fire Membership",
  "Bangladesh Topup Site",
];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  const title = settings.metaTitle || `${settings.siteName} - ${settings.tagline}`;
  const description = settings.metaDescription || DEFAULT_DESCRIPTION;
  const keywords = settings.metaKeywords
    ? settings.metaKeywords.split(",").map((k) => k.trim()).filter(Boolean)
    : DEFAULT_KEYWORDS;
  const ogImage = settings.ogImage || "/images/product_special_offer.jpg";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${settings.siteName}`,
    },
    description,
    keywords,
    icons: {
      icon: settings.favicon || "/favicon.ico",
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: settings.siteName,
    },
    openGraph: {
      type: "website",
      locale: "bn_BD",
      url: siteUrl,
      siteName: settings.siteName,
      title,
      description,
      images: [{ url: ogImage, width: 800, height: 800 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: "/",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName,
    url: siteUrl,
    logo: `${siteUrl}/images/logo.png`,
    description: settings.tagline,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: `+88${settings.whatsappNumber}`,
      contactType: "customer service",
      email: settings.contactEmail,
      availableLanguage: ["Bengali", "English"],
    },
  };

  return (
    <html
      lang="bn"
      data-scroll-behavior="smooth"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-sans text-gray-800 pb-16 md:pb-0"
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <PwaRegister />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={settings} />
        <HelpBubble whatsappNumber={settings.whatsappNumber} />
        <MobileBottomNav />
      </body>
    </html>
  );
}
