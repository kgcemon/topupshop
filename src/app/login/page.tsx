import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { GoogleSignInButton } from "@/components/google-signin-button";

export const metadata: Metadata = {
  title: "Login",
  description: "আপনার Uc Ghor একাউন্টে লগইন করুন।",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-5 text-2xl font-bold">Login</h1>

        {error === "AccessDenied" && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            আপনার একাউন্টটি সাময়িক বা স্থায়ীভাবে ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।
          </p>
        )}

        <div className="mb-4">
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-grow bg-gray-200" />
          <span className="whitespace-nowrap text-xs text-gray-500">Or sign in with credentials</span>
          <div className="h-px flex-grow bg-gray-200" />
        </div>

        <LoginForm callbackUrl={callbackUrl || "/dashboard"} />
      </div>
    </div>
  );
}
