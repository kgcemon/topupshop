import Image from "next/image";
import Link from "next/link";

type Settings = {
  siteName: string;
  tagline: string;
  whatsappNumber: string;
  telegramLink: string;
  facebookLink?: string | null;
  contactEmail: string;
  logo?: string | null;
};

const legalLinks = [
  { href: "/about-us", label: "About Us" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund & Return Policy" },
];

const supportLinks = [
  { href: "/", label: "Home" },
  { href: "/#topup", label: "TopUp" },
  { href: "/blog", label: "Blog" },
  { href: "/contact-us", label: "Contact Us" },
];

const FOOTER_TITLE =
  "mt-5 pb-3 font-primary text-xl font-normal uppercase tracking-wider text-white";
const FOOTER_LINK =
  "block font-primary text-sm font-medium leading-[23px] text-[#bbb8b8] transition-colors hover:text-white";

export function SiteFooter({ settings }: { settings: Settings }) {
  return (
    <footer className="footer-bg mb-16 border-t-2 border-gray-200 text-gray-200 md:mb-0">
      <section className="container mx-auto pb-8">
        <div className="m-auto flex flex-wrap">
          {/* Left 4/6 — brand block beside the notice and helpline cards. */}
          <div className="m-auto my-0 flex w-full flex-wrap md:w-4/6">
            <div className="w-full px-5 pt-5 md:w-1/3 md:px-0">
              <span className="inline-block rounded-lg bg-white px-3 py-2">
                <Image
                  src={settings.logo || "/images/logo.png"}
                  alt={`${settings.siteName} Logo`}
                  width={160}
                  height={35}
                  unoptimized={!!settings.logo}
                  className="h-auto w-36"
                />
              </span>
              <p className="mt-4 font-primary text-lg text-white">Free Fire Diamond TopUp</p>
              <p className="text-sm text-[#bbb8b8]">{settings.tagline}</p>
            </div>

            <div className="w-full px-5 md:w-2/3 md:pl-20 md:pr-0">
              <div className={FOOTER_TITLE}>Notice</div>
              <p className="mb-3 text-sm leading-relaxed text-[#bbb8b8]">
                মা-বাবা বা ফ্যামিলির কারো ফোন থেকে না বলে টাকা পাঠিয়ে টপ-আপ করলে তার অ্যাকাউন্ট
                স্থায়ীভাবে ব্লক করে দেওয়া হবে এবং তার বিরুদ্ধে আইনগত ব্যাবস্থা নেওয়া হবে।
              </p>
              <p className="text-sm text-[#bbb8b8]">
                যেকোনো প্রয়োজনে আমাদের এই হোয়াটসঅ্যাপে যোগাযোগ করবেন।{" "}
                <a
                  href={`https://wa.me/88${settings.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white hover:text-primary-400"
                >
                  {settings.whatsappNumber}
                </a>
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href={`https://wa.me/88${settings.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
                >
                  <p className="text-sm font-bold text-white">Whatsapp HelpLine ✔</p>
                  <p className="text-xs text-[#bbb8b8]">সকাল ৮টা থেকে রাত ১২টা</p>
                </a>
                <a
                  href={settings.telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
                >
                  <p className="text-sm font-bold text-white">Telegram HelpLine ✔</p>
                  <p className="text-xs text-[#bbb8b8]">সকাল ৮টা থেকে রাত ১২টা</p>
                </a>
                {settings.facebookLink && (
                  <a
                    href={settings.facebookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
                  >
                    <p className="text-sm font-bold text-white">Facebook HelpLine ✔</p>
                    <p className="text-xs text-[#bbb8b8]">সকাল ৮টা থেকে রাত ১২টা</p>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right 2/6 — support nav, indented away from the content on desktop. */}
          <div className="w-full px-5 pt-5 md:w-2/6 md:px-0">
            <div className="md:ml-20">
              <div className={FOOTER_TITLE}>Support Center</div>
              <div className="flex flex-col">
                {supportLinks.map((link) => (
                  <Link key={link.label} href={link.href} className={FOOTER_LINK}>
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className={FOOTER_TITLE}>Contact</div>
              <a href={`mailto:${settings.contactEmail}`} className={FOOTER_LINK}>
                {settings.contactEmail}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t-2 border-[rgba(193,188,188,0.11)]">
        <div className="m-auto flex flex-col items-center justify-center px-5 pb-5 pt-5 text-sm text-[#b1b1b1]">
          <nav className="mx-auto mb-2 flex max-w-[900px] flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-bold opacity-[0.82] transition-opacity hover:text-primary-400 hover:opacity-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 text-center font-primary tracking-wide">
            © {settings.siteName} {new Date().getFullYear()} | All Rights Reserved | Developed By{" "}
            <a
              href="https://wa.me/8801300300999"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white hover:text-primary-400"
            >
              Emon Khan
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
