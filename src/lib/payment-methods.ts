import { cache } from "react";
import { credentialsFrom, getPaymentGatewaySetting } from "@/lib/eps-client";

export type PaymentMethodConfig = {
  wallet: { enabled: boolean; title: string };
  manual: { enabled: boolean; title: string };
  eps: { enabled: boolean; title: string; subtitle: string | null; icon: string | null };
};

/**
 * Which checkout methods are on, and what they are called — the only part of
 * PaymentGatewaySetting that may reach the browser. EPS counts as on only
 * when it is switched on AND fully configured, so a half-filled credential
 * form can never put a broken button in front of customers.
 */
export const getPaymentMethodConfig = cache(async (): Promise<PaymentMethodConfig> => {
  const s = await getPaymentGatewaySetting();
  return {
    wallet: { enabled: s.walletPayEnabled, title: s.walletPayTitle || "Wallet Pay" },
    manual: { enabled: s.manualPayEnabled, title: s.manualPayTitle || "Manual Pay" },
    eps: {
      enabled: s.epsEnabled && credentialsFrom(s) !== null,
      title: s.epsTitle || "Auto Pay",
      subtitle: s.epsSubtitle || null,
      icon: s.epsIcon || null,
    },
  };
});
