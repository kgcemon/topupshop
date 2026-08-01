import { getSiteSettings } from "@/lib/data";
import { SiteSettingsForm } from "@/components/site-settings-form";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">Site Settings</h1>
      <SiteSettingsForm
        defaultValues={{
          siteName: settings.siteName,
          tagline: settings.tagline,
          metaTitle: settings.metaTitle,
          metaDescription: settings.metaDescription,
          metaKeywords: settings.metaKeywords,
          ogImage: settings.ogImage,
          favicon: settings.favicon,
          whatsappNumber: settings.whatsappNumber,
          telegramLink: settings.telegramLink,
          facebookLink: settings.facebookLink,
          contactEmail: settings.contactEmail,
          bkashNumber: settings.bkashNumber,
          nagadNumber: settings.nagadNumber,
          rocketNumber: settings.rocketNumber,
          bkashIcon: settings.bkashIcon,
          nagadIcon: settings.nagadIcon,
          rocketIcon: settings.rocketIcon,
          walletIcon: settings.walletIcon,
          referralBonusPercent: settings.referralBonusPercent,
          allowGuestOrders: settings.allowGuestOrders,
        }}
      />
    </div>
  );
}
