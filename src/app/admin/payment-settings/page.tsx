import { getSiteSettings } from "@/lib/data";
import { getPaymentGatewaySetting } from "@/lib/eps-client";
import { PaymentSettingsForm } from "@/components/payment-settings-form";
import { PaymentGatewayForm } from "@/components/payment-gateway-form";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export default async function AdminPaymentSettingsPage() {
  const [settings, gateway] = await Promise.all([getSiteSettings(), getPaymentGatewaySetting()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-lg font-bold">Payment Settings</h1>
        <p className="mb-4 text-xs text-gray-500">
          পেমেন্ট মেথড চালু/বন্ধ, তাদের নাম এবং EPS অটো পেমেন্ট গেটওয়ে এখান থেকে নিয়ন্ত্রণ করুন।
        </p>
        <PaymentGatewayForm
          returnUrlExample={`${SITE_URL}/api/eps/return/<ref>/success`}
          defaultValues={{
            walletPayEnabled: gateway.walletPayEnabled,
            walletPayTitle: gateway.walletPayTitle,
            manualPayEnabled: gateway.manualPayEnabled,
            manualPayTitle: gateway.manualPayTitle,
            epsEnabled: gateway.epsEnabled,
            epsTitle: gateway.epsTitle,
            epsSubtitle: gateway.epsSubtitle,
            epsApiBaseUrl: gateway.epsApiBaseUrl,
            epsUserName: gateway.epsUserName,
            epsMerchantId: gateway.epsMerchantId,
            epsStoreId: gateway.epsStoreId,
            // The secrets themselves never leave the server.
            hasPassword: !!gateway.epsPassword,
            hasHashKey: !!gateway.epsHashKey,
          }}
        />
      </div>

      <div>
        <h2 className="mb-1 text-base font-bold">Manual Pay নাম্বার</h2>
        <p className="mb-4 text-xs text-gray-500">
          ম্যানুয়াল পেমেন্টের নাম্বার ও bKash-এর সর্বনিম্ন অ্যামাউন্ট ওয়ার্নিং এখান থেকে নিয়ন্ত্রণ করুন।
        </p>
        <PaymentSettingsForm
          defaultValues={{
            bkashNumber: settings.bkashNumber,
            nagadNumber: settings.nagadNumber,
            rocketNumber: settings.rocketNumber,
            bkashMinAmount: settings.bkashMinAmount,
            bkashMinWarning: settings.bkashMinWarning,
          }}
        />
      </div>
    </div>
  );
}
