import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";
import { GoogleSignInButton } from "@/components/google-signin-button";

export const metadata: Metadata = {
  title: "Register",
  description: "নতুন TopUpsBD একাউন্ট তৈরি করুন।",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-5 text-2xl font-bold">Login</h1>

        <div className="mb-4">
          <GoogleSignInButton />
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-grow bg-gray-200" />
          <span className="whitespace-nowrap text-xs text-gray-500">Or sign up with credentials</span>
          <div className="h-px flex-grow bg-gray-200" />
        </div>

        <RegisterForm defaultReferralCode={ref?.toUpperCase()} />
      </div>
    </div>
  );
}
