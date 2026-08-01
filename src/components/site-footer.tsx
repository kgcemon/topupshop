import Image from "next/image";
import Link from "next/link";

type Settings = {
  siteName: string;
  tagline: string;
  whatsappNumber: string;
  telegramLink: string;
  facebookLink?: string | null;
  contactEmail: string;
};

export function SiteFooter({ settings }: { settings: Settings }) {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <Image
            src="/images/logo.png"
            alt="TopUpsBD Logo"
            width={160}
            height={46}
            className="w-40 h-auto mb-4"
          />
          <p className="font-bold">Free Fire Diamond TopUp</p>
          <p className="font-bold mb-4">{settings.tagline}</p>
          <p className="font-bold mb-2">নোটিশ:</p>
          <p className="text-sm mb-2 text-gray-600">
            মা-বাবা বা ফ্যামিলির কারো ফোন থেকে না বলে টাকা পাঠিয়ে টপ-আপ করলে তার অ্যাকাউন্ট
            স্থায়ীভাবে ব্লক করে দেওয়া হবে এবং তার বিরুদ্ধে আইনগত ব্যাবস্থা নেওয়া হবে।
          </p>
          <p className="text-sm text-gray-600">
            যেকোনো প্রয়োজনে আমাদের এই হোয়াটসঅ্যাপে যোগাযোগ করবেন।
          </p>
          <p className="text-sm font-bold">{settings.whatsappNumber}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Company</h2>
          <div className="space-y-2.5 text-sm">
            <Link href="/about-us" className="block text-gray-600 hover:text-primary-600">
              About Us
            </Link>
            <Link href="/contact-us" className="block text-gray-600 hover:text-primary-600">
              Contact Us
            </Link>
            <Link href="/blog" className="block text-gray-600 hover:text-primary-600">
              Blog
            </Link>
            <Link href="/terms-and-conditions" className="block text-gray-600 hover:text-primary-600">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy-policy" className="block text-gray-600 hover:text-primary-600">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="block text-gray-600 hover:text-primary-600">
              Refund Policy
            </Link>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Contact Us</h2>
          <div className="space-y-3">
            <a
              href={`https://wa.me/88${settings.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:shadow-md transition-shadow"
            >
              <p className="font-bold text-sm">Whatsapp HelpLine ✔</p>
              <p className="text-xs text-gray-500">সকাল ৮টা থেকে রাত ১২টা</p>
            </a>
            <a
              href={settings.telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:shadow-md transition-shadow"
            >
              <p className="font-bold text-sm">Telegram HelpLine ✔</p>
              <p className="text-xs text-gray-500">সকাল ৮টা থেকে রাত ১২টা</p>
            </a>
            {settings.facebookLink && (
              <a
                href={settings.facebookLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:shadow-md transition-shadow"
              >
                <p className="font-bold text-sm">Facebook HelpLine ✔</p>
                <p className="text-xs text-gray-500">সকাল ৮টা থেকে রাত ১২টা</p>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200 py-4 text-center text-sm text-gray-600">
        All Rights Reserved | Developed By{" "}
        <a
          href="https://wa.me/8801300300999"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold hover:text-primary-600"
        >
          Emon Khan
        </a>{" "}
        (01300300999)
      </div>
    </footer>
  );
}
