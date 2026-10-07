import { getSiteSettings } from "@/lib/data";
import { PaymentSettingsForm } from "@/components/payment-settings-form";

export default async function AdminPaymentSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">Payment Settings</h1>
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
  );
}
