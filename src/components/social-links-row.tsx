type SocialLink = {
  href: string;
  label: string;
  name: string;
  icon: React.ReactNode;
};

const telegramIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-primary-500 md:h-5 md:w-5">
    <path d="M21.05 3.79 2.6 10.98c-1.24.5-1.23 1.2-.23 1.5l4.72 1.47 1.82 5.53c.22.6.37.84.75.84.38 0 .55-.17.75-.38l1.8-1.75 4.75 3.5c.87.48 1.5.23 1.72-.8L22 5.06c.3-1.26-.48-1.83-1.95-1.27Z" />
  </svg>
);

const facebookIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-primary-500 md:h-5 md:w-5">
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
  </svg>
);

const whatsappIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-primary-500 md:h-5 md:w-5">
    <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.34A10 10 0 1 0 12 2Zm5.8 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.11-1.26.2-3.68-.79-3.09-1.28-5.08-4.42-5.23-4.63-.15-.2-1.25-1.66-1.25-3.17s.79-2.25 1.07-2.56c.28-.3.6-.38.8-.38h.58c.19 0 .43-.04.68.51.25.55.85 1.9.93 2.04.08.15.13.32.02.52-.11.2-.16.32-.32.5-.16.18-.34.4-.49.54-.16.15-.33.32-.14.63.19.31.85 1.4 1.83 2.27 1.26 1.12 2.32 1.47 2.63 1.63.31.16.49.13.68-.08.19-.21.79-.92 1-1.23.21-.31.42-.26.7-.16.28.1 1.79.85 2.1 1 .31.16.51.23.58.36.08.13.08.75-.17 1.45Z" />
  </svg>
);

export function SocialLinksRow({
  telegramLink,
  facebookLink,
  whatsappNumber,
}: {
  telegramLink?: string | null;
  facebookLink?: string | null;
  whatsappNumber?: string | null;
}) {
  const links: SocialLink[] = [];

  if (telegramLink) {
    links.push({ href: telegramLink, label: "Group", name: "Join Group", icon: telegramIcon });
  }
  if (facebookLink) {
    links.push({ href: facebookLink, label: "Page", name: "Facebook", icon: facebookIcon });
  }
  if (whatsappNumber) {
    links.push({
      href: `https://wa.me/88${whatsappNumber}`,
      label: "Support",
      name: "Whatsapp",
      icon: whatsappIcon,
    });
  }

  if (!links.length) return null;

  return (
    <section className="mb-4 flex flex-col items-center md:my-2">
      <div className="container mt-3">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-md bg-gradient-to-r from-primary-500 to-primary-500/90 px-2 py-2 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl md:gap-6 md:rounded-xl md:px-3 md:py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 group-hover:scale-110 md:h-8 md:w-8">
                {link.icon}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[8px] uppercase text-white/70 md:text-[10px]">
                  {link.label}
                </span>
                <span className="block truncate text-[10px] font-semibold text-white md:text-sm">
                  {link.name}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
