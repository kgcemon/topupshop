import { signOut } from "@/lib/auth";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className={className ?? "text-sm font-bold border-2 border-gray-300 rounded px-3 py-2 hover:bg-gray-100 transition-colors"}
      >
        Logout
      </button>
    </form>
  );
}
