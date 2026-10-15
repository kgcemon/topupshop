// The payment-method card shared by the topup checkout and the wallet deposit
// form, so both pickers look and behave the same.

// Corner tick marking the payment method currently picked.
function SelectedCheck({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute left-0 top-0 z-[5] flex h-6 w-6 items-center justify-center bg-primary-500 text-white ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function PayOption({
  active,
  icon,
  subtitle,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`payment-option relative flex min-w-0 flex-col text-center ${active ? "is-active" : ""}`}
    >
      {active && <SelectedCheck className="rounded-br-lg" />}
      {badge && (
        <span className="absolute right-1 top-1 z-[5] rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white">
          {badge}
        </span>
      )}
      <span className="flex h-20 w-full items-center justify-center p-3">{icon}</span>
      <span className="truncate border-t border-gray-200 bg-gray-100 px-1 py-1.5 text-xs font-bold text-gray-700">{subtitle}</span>
    </button>
  );
}
