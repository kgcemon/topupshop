import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Uc Ghor হলো বাংলাদেশের অন্যতম বিশ্বস্ত Free Fire Diamond TopUp প্ল্যাটফর্ম — দ্রুত ডেলিভারি, নিরাপদ পেমেন্ট এবং ২৪ ঘন্টা সাপোর্ট নিয়ে আমরা কাজ করছি।",
  alternates: { canonical: "/about-us" },
};

export default async function AboutUsPage() {
  const settings = await getSiteSettings();

  return (
    <LegalPage title="About Us">
      <p>
        <strong>{settings.siteName}</strong> ({settings.tagline}) বাংলাদেশের গেমারদের জন্য একটি নির্ভরযোগ্য অনলাইন
        টপ-আপ প্ল্যাটফর্ম, যেখান থেকে আপনি সহজে ও নিরাপদে Free Fire UID Diamond TopUp, Weekly/Monthly Membership এবং
        Level Up Pass কিনতে পারেন।
      </p>
      <p>
        আমাদের লক্ষ্য হলো গেমারদের জন্য সবচেয়ে দ্রুত, নিরাপদ এবং সাশ্রয়ী টপ-আপ অভিজ্ঞতা তৈরি করা — কোনো ঝামেলা ছাড়াই,
        যেকোনো সময়, যেকোনো জায়গা থেকে।
      </p>

      <h2>আমাদের যা কিছু ভালো লাগে</h2>
      <ul>
        <li>স্বয়ংক্রিয় এবং ম্যানুয়াল উভয় পদ্ধতিতে দ্রুত ডেলিভারি</li>
        <li>bKash, Nagad, Rocket এবং ওয়ালেট ব্যালেন্স দিয়ে পেমেন্টের সুবিধা</li>
        <li>প্রতিটি অর্ডার এডমিন টিম দ্বারা যাচাই করে সম্পন্ন করা হয়</li>
        <li>রেফারেল প্রোগ্রামের মাধ্যমে বন্ধুদের রেফার করে বোনাস আয়ের সুযোগ</li>
        <li>{settings.whatsappNumber} নাম্বারে সকাল ৮টা থেকে রাত ১২টা পর্যন্ত লাইভ সাপোর্ট</li>
      </ul>

      <h2>যোগাযোগ</h2>
      <p>
        যেকোনো প্রশ্ন বা সহায়তার জন্য আমাদের{" "}
        <a href="/contact-us">Contact Us</a> পেজ থেকে WhatsApp, Telegram বা ইমেইলে ({settings.contactEmail})
        যোগাযোগ করতে পারেন।
      </p>
    </LegalPage>
  );
}
