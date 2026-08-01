"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="mb-1 block font-bold text-secondary-900" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="Email"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <label className="mb-1 block font-bold text-secondary-900" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        placeholder="Password"
        className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-md bg-primary-500 py-2 font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "লগইন হচ্ছে..." : "Login"}
      </button>
      <p className="mt-4 text-center text-sm">
        New user to TopUpsBD?{" "}
        <Link href="/register" className="font-bold text-primary-600">
          Register Now
        </Link>
      </p>
    </form>
  );
}
