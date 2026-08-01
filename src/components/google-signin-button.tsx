import { signIn } from "@/lib/auth";
import { GoogleSignInSubmitButton } from "@/components/google-signin-submit-button";

export function GoogleSignInButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: callbackUrl || "/dashboard" });
      }}
      className="flex justify-center"
    >
      <GoogleSignInSubmitButton />
    </form>
  );
}
