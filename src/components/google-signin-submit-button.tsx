"use client";

import { useFormStatus } from "react-dom";

export function GoogleSignInSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5c-6.4 0-11.6-5.2-11.6-11.6S17.6 12.3 24 12.3c2.9 0 5.5 1.1 7.5 2.8l6-6C34.3 5.9 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.4-7.9 19.4-19.5 0-1.3-.1-2.7-.4-4z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.6 19 12.3 24 12.3c2.9 0 5.5 1.1 7.5 2.8l6-6C34.3 5.9 29.4 4 24 4c-7.4 0-13.8 4.1-17.2 10.1z" />
          <path fill="#4CAF50" d="M24 44c5.3 0 10.1-1.8 13.8-4.9l-6.4-5.4C29.3 35.4 26.8 36.2 24 36.2c-5.3 0-9.8-3.4-11.4-8l-6.6 5.1C9.1 39.6 16 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.7 4.9l6.4 5.4C41.3 35.3 44 30.1 44 24c0-1.3-.1-2.7-.4-3.5z" />
        </svg>
      )}
      {pending ? "Signing in..." : "Login with Google"}
    </button>
  );
}
