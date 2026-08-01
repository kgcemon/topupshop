import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "TopUpsBD-এর রিফান্ড ও ক্যান্সেলেশন পলিসি — কখন রিফান্ড পাবেন এবং কীভাবে রিফান্ড প্রসেস করা হয় তা জানুন।",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const settings = await getSiteSettings();

  return (
    <LegalPage title="Refund & Cancellation Policy" updatedAt="১ আগস্ট, ২০২৬">
      <p>
        Free Fire Diamond, Membership এবং Level Up Pass ডিজিটাল পণ্য — অর্ডার সফলভাবে ডেলিভার হয়ে গেলে তা আর
        ফেরত নেওয়া বা বাতিল করা সম্ভব নয়। অর্ডার করার আগে অনুগ্রহ করে আপনার Player ID এবং প্যাকেজ দুইবার
        যাচাই করে নিন।
      </p>

      <h2>যেসব ক্ষেত্রে রিফান্ড প্রযোজ্য</h2>
      <ul>
        <li>ভুল/অস্তিত্বহীন Player ID-এর কারণে অর্ডার ডেলিভার করা সম্ভব না হলে</li>
        <li>স্টক সংকট বা টেকনিক্যাল সমস্যার কারণে এডমিন কর্তৃক অর্ডার Reject/Cancel করা হলে</li>
        <li>পেমেন্ট সম্পন্ন হওয়ার পরও নির্দিষ্ট সময়ের মধ্যে অর্ডার ডেলিভার করা না গেলে</li>
      </ul>

      <h2>রিফান্ড কীভাবে প্রসেস করা হয়</h2>
      <p>
        ওয়ালেট ব্যালেন্স দিয়ে করা কোনো অর্ডার Reject/Cancel হলে সেই টাকা সাথে সাথে স্বয়ংক্রিয়ভাবে আপনার ওয়ালেটে
        ফেরত জমা হয়ে যায় — Dashboard-এর Wallet Transactions-এ তা দেখতে পাবেন।
      </p>
      <p>
        bKash/Nagad/Rocket দিয়ে সরাসরি পেমেন্ট করা কোনো অর্ডার Reject/Cancel হলে, আমাদের সাপোর্ট টিম আপনার
        ট্রানজেকশন যাচাই করে ম্যানুয়ালি একই নাম্বারে রিফান্ড পাঠিয়ে দেয় অথবা অনুরোধ সাপেক্ষে ওয়ালেটে ক্রেডিট করে
        দেয় — সাধারণত ২৪-৪৮ ঘন্টার মধ্যে।
      </p>

      <h2>ওয়ালেট ডিপোজিট বাতিল</h2>
      <p>
        ওয়ালেটে করা ডিপোজিট রিকোয়েস্ট এডমিন কর্তৃক Reject হলে সেই টাকা আপনার একাউন্টে যোগ হয় না — লেনদেনটি
        সঠিকভাবে সম্পন্ন হয়েছে কিনা যাচাই করতে অনুগ্রহ করে সঠিক Transaction ID জমা দিন।
      </p>

      <h2>রিফান্ডের জন্য যোগাযোগ</h2>
      <p>
        রিফান্ড সংক্রান্ত যেকোনো সমস্যায় অর্ডার নাম্বারসহ আমাদের হোয়াটসঅ্যাপে ({settings.whatsappNumber}) অথবা
        ইমেইলে (<a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>) যোগাযোগ করুন।
      </p>
    </LegalPage>
  );
}
