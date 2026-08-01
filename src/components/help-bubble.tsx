export function HelpBubble({ whatsappNumber }: { whatsappNumber: string }) {
  return (
    <a
      href={`https://wa.me/88${whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed right-5 bottom-20 z-40 md:bottom-5"
      aria-label="WhatsApp সাহায্য"
    >
      <span className="pointer-events-none absolute right-14 bottom-1 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        সাহায্য লাগবে ?
      </span>
      <span className="block rounded-full bg-green-600 p-3 text-white shadow-lg transition-colors hover:bg-green-700">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-7 w-7">
          <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.34A10 10 0 1 0 12 2Zm5.8 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.11-1.26.2-3.68-.79-3.09-1.28-5.08-4.42-5.23-4.63-.15-.2-1.25-1.66-1.25-3.17s.79-2.25 1.07-2.56c.28-.3.6-.38.8-.38h.58c.19 0 .43-.04.68.51.25.55.85 1.9.93 2.04.08.15.13.32.02.52-.11.2-.16.32-.32.5-.16.18-.34.4-.49.54-.16.15-.33.32-.14.63.19.31.85 1.4 1.83 2.27 1.26 1.12 2.32 1.47 2.63 1.63.31.16.49.13.68-.08.19-.21.79-.92 1-1.23.21-.31.42-.26.7-.16.28.1 1.79.85 2.1 1 .31.16.51.23.58.36.08.13.08.75-.17 1.45Z" />
        </svg>
      </span>
    </a>
  );
}
