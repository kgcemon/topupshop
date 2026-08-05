import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
  password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "নাম কমপক্ষে ২ ক্যারেক্টার হতে হবে"),
    phone: z
      .string()
      .trim()
      .regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নাম্বার দিন (01xxxxxxxxx)"),
    email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
    password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে"),
    confirmPassword: z.string(),
    referralCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "পাসওয়ার্ড মিলছে না",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "নাম কমপক্ষে ২ ক্যারেক্টার হতে হবে").max(60),
  phone: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নাম্বার দিন (01xxxxxxxxx)"),
});

export const orderSchema = z.object({
  productId: z.coerce.number().int().positive(),
  rechargeOptionId: z.coerce.number().int().positive(),
  playerId: z.string().trim().min(3, "প্লেয়ার আইডি দিন").max(30),
  playerName: z.string().trim().max(60).optional().or(z.literal("")),
  paymentMethod: z.enum(["WALLET", "BKASH", "NAGAD", "ROCKET"]),
  transactionId: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9]+$/, "ট্রানজেকশন আইডিতে স্পেস বা স্পেশাল ক্যারেক্টার ব্যবহার করা যাবে না")
    .optional()
    .or(z.literal("")),
});

export const guestContactSchema = z.object({
  guestName: z.string().trim().min(2, "নাম দিন").max(60),
  guestPhone: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নাম্বার দিন (01xxxxxxxxx)"),
});

export const depositSchema = z.object({
  amount: z.coerce.number().int().min(20, "সর্বনিম্ন ২০ টাকা জমা দিতে হবে").max(100000),
  method: z.enum(["BKASH", "NAGAD", "ROCKET"]),
  transactionId: z
    .string()
    .trim()
    .min(3, "ট্রানজেকশন আইডি দিন")
    .max(60)
    .regex(/^[A-Za-z0-9]+$/, "ট্রানজেকশন আইডিতে স্পেস বা স্পেশাল ক্যারেক্টার ব্যবহার করা যাবে না"),
});

export const broadcastNotificationSchema = z.object({
  message: z.string().trim().min(1, "মেসেজ লিখুন").max(500, "মেসেজ সর্বোচ্চ ৫০০ ক্যারেক্টার হতে পারবে"),
  link: z.string().trim().optional().or(z.literal("")),
});

export const sectionFormSchema = z.object({
  name: z.string().trim().min(1, "নাম আবশ্যক").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "শুধু lowercase, সংখ্যা এবং হাইফেন ব্যবহার করুন"),
  sortOrder: z.coerce.number().int(),
  isActive: z.coerce.boolean(),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "শুধু lowercase, সংখ্যা এবং হাইফেন ব্যবহার করুন"),
  image: z.string().trim().min(1),
  sectionId: z.coerce.number().int().positive("Section সিলেক্ট করুন"),
  type: z.enum(["NORMAL", "EXTERNAL_LINK"]),
  externalUrl: z.string().trim().url().optional().or(z.literal("")),
  category: z.string().trim().min(1),
  description: z.string().trim().optional().or(z.literal("")),
  inputLabel: z.string().trim().max(60).optional().or(z.literal("")),
  isActive: z.coerce.boolean(),
  stockOut: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

export const blogPostFormSchema = z.object({
  title: z.string().trim().min(3, "টাইটেল কমপক্ষে ৩ ক্যারেক্টার হতে হবে"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "শুধু lowercase, সংখ্যা এবং হাইফেন ব্যবহার করুন"),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  content: z.string().trim().min(20, "কনটেন্ট আরও একটু বড় লিখুন"),
  metaTitle: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(300).optional().or(z.literal("")),
  metaKeywords: z.string().trim().max(300).optional().or(z.literal("")),
  isPublished: z.coerce.boolean(),
});

export const blogCommentSchema = z.object({
  postId: z.coerce.number().int().positive(),
  content: z.string().trim().min(2, "কমেন্ট আরেকটু বড় লিখুন").max(1000, "কমেন্ট সর্বোচ্চ ১০০০ ক্যারেক্টার হতে পারবে"),
  parentId: z.string().trim().optional().or(z.literal("")),
});

export const reviewFormSchema = z.object({
  productId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1, "রেটিং দিন").max(5, "রেটিং সর্বোচ্চ ৫"),
  comment: z.string().trim().min(5, "মন্তব্য কমপক্ষে ৫ ক্যারেক্টার লিখুন").max(1000, "মন্তব্য সর্বোচ্চ ১০০০ ক্যারেক্টার হতে পারবে"),
});

export const marketListingFormSchema = z
  .object({
    game: z.string().trim().min(2, "গেমের নাম দিন").max(60),
    title: z.string().trim().min(5, "টাইটেল কমপক্ষে ৫ ক্যারেক্টার দিন").max(100),
    description: z.string().trim().min(10, "বিস্তারিত বিবরণ দিন (কমপক্ষে ১০ ক্যারেক্টার)").max(2000),
    price: z.coerce.number().int().min(1, "মূল্য দিন"),
    contactNumber: z
      .string()
      .trim()
      .regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নাম্বার দিন (01xxxxxxxxx)")
      .optional()
      .or(z.literal("")),
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^[+\d][\d\s-]{7,19}$/, "সঠিক WhatsApp নাম্বার দিন")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.contactNumber || data.whatsappNumber, {
    message: "কন্টাক্ট নাম্বার অথবা WhatsApp নাম্বার আবশ্যক",
    path: ["contactNumber"],
  });

export const marketOfferFormSchema = z.object({
  listingId: z.string().trim().min(1),
  offerPrice: z.coerce.number().int().min(1, "অফার প্রাইস দিন"),
  message: z.string().trim().max(500, "মেসেজ সর্বোচ্চ ৫০০ ক্যারেক্টার হতে পারবে").optional().or(z.literal("")),
});

export const siteSettingsSchema = z.object({
  siteName: z.string().trim().min(1, "সাইট নাম আবশ্যক"),
  tagline: z.string().trim().min(1, "ট্যাগলাইন আবশ্যক"),
  metaTitle: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(300).optional().or(z.literal("")),
  metaKeywords: z.string().trim().max(300).optional().or(z.literal("")),
  whatsappNumber: z.string().trim().min(1, "WhatsApp নাম্বার আবশ্যক"),
  telegramLink: z.string().trim().url("সঠিক টেলিগ্রাম লিংক দিন").optional().or(z.literal("")),
  facebookLink: z.string().trim().url("সঠিক ফেসবুক লিংক দিন").optional().or(z.literal("")),
  contactEmail: z.string().trim().email("সঠিক ইমেইল দিন"),
  bkashNumber: z.string().trim().min(1),
  nagadNumber: z.string().trim().min(1),
  rocketNumber: z.string().trim().min(1),
  referralBonusPercent: z.coerce
    .number()
    .min(1, "সর্বনিম্ন ১%")
    .max(1.5, "সর্বোচ্চ ১.৫%"),
  smtpHost: z.string().trim().max(255).optional().or(z.literal("")),
  smtpPort: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(65535).optional()
  ),
  smtpUser: z.string().trim().max(255).optional().or(z.literal("")),
  smtpFromEmail: z.string().trim().email("সঠিক ইমেইল দিন").optional().or(z.literal("")),
  smtpFromName: z.string().trim().max(255).optional().or(z.literal("")),
});
