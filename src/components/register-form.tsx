"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function RegisterForm({ defaultReferralCode }: { defaultReferralCode?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const formKey = JSON.stringify(state);

  return (
    <form key={formKey} action={formAction}>
      <Field
        label="Name"
        name="name"
        type="text"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Field
        label="Phone"
        name="phone"
        type="text"
        placeholder="01xxxxxxxxx"
        defaultValue={state.values?.phone}
        error={state.fieldErrors?.phone}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        placeholder="Password"
        error={state.fieldErrors?.confirmPassword}
      />
      <Field
        label="Referral Code (ঐচ্ছিক)"
        name="referralCode"
        type="text"
        placeholder="কারো রেফারেল কোড থাকলে দিন"
        defaultValue={state.values?.referralCode || defaultReferralCode}
        error={state.fieldErrors?.referralCode}
        required={false}
        last
      />

      {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-md bg-primary-500 py-2 font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "একাউন্ট তৈরি হচ্ছে..." : "Register"}
      </button>
      <p className="mt-4 text-center text-sm">
        Already member?{" "}
        <Link href="/login" className="font-bold text-primary-600">
          Login Now
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  defaultValue,
  error,
  required = true,
  last,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  last?: boolean;
}) {
  return (
    <div className={last ? "mb-2" : "mb-4"}>
      <label className="mb-1 block font-bold text-secondary-900" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder ?? label}
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
