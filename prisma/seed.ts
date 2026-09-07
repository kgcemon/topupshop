import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const RULES_COMMON = [
  "শুধুমাত্র Bangladesh সার্ভারের ID Code দিয়ে টপ আপ হবে।",
  "Player ID Code ভুল দিয়ে Diamond না পেলে topupshop কর্তৃপক্ষ দায়ী নয়।",
  "অর্ডার Cancel হলে কি কারণে তা Cancel হয়েছে, তা অর্ডার হিস্টোরিতে দেওয়া থাকে, অনুগ্রহ পূর্বক দেখে পুনরায় সঠিক তথ্য দিয়ে অর্ডার করবেন।",
  "যেকোনো সমস্যায় আমাদের WhatsApp এ মেসেজ দিন 01343053411",
  "বিঃদ্রঃ মা-বাবা বা ফ্যামিলির কারো ফোন থেকে টাকা চুরি করে টপআপ করলে তার বিরুদ্ধে আইনগত ব্যাবস্থা নেয়া হবে।",
];

async function main() {
  console.log("Seeding site settings, banners, notice...");

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      siteName: "topupshop.co",
      tagline: "Largest TopUp Site In Bangladesh",
      whatsappNumber: "01343053411",
      telegramLink: "https://t.me/+K3PmqW02YCI2OGRl",
      contactEmail: "support@topupshop.co",
    },
  });

  await prisma.notice.deleteMany();
  await prisma.notice.create({
    data: {
      message:
        "topupshop এ ২৪ ঘন্টাই টপআপ চালু থাকে....!!! যেকোনো সমস্যায় আমাদের WhatsApp এ মেসেজ দিন 01343053411 ......... বিঃদ্রঃ মা-বাবা বা ফ্যামিলির কারো ফোন থেকে টাকা চুরি করে টপআপ করলে তার বিরুদ্ধে আইনগত ব্যাবস্থা নেয়া হবে",
      isActive: true,
    },
  });

  await prisma.banner.deleteMany();
  await prisma.banner.createMany({
    data: [
      { image: "/images/banner1.jpg", sortOrder: 1, isActive: true },
      { image: "/images/banner2.jpeg", sortOrder: 2, isActive: true },
      { image: "/images/banner3.jpeg", sortOrder: 3, isActive: true },
    ],
  });

  console.log("Seeding sections...");

  const specialOfferSection = await prisma.section.upsert({
    where: { slug: "special-offer" },
    update: {},
    create: { name: "Special Offer", slug: "special-offer", sortOrder: 0, isActive: true },
  });
  const freeFireSection = await prisma.section.upsert({
    where: { slug: "free-fire" },
    update: {},
    create: { name: "Free Fire", slug: "free-fire", sortOrder: 1, isActive: true },
  });

  console.log("Seeding products...");

  const products = [
    {
      name: "Special Offer",
      slug: "special-offer",
      image: "/images/product_special_offer.jpg",
      sectionId: specialOfferSection.id,
      type: "NORMAL" as const,
      sortOrder: 1,
      rules: [
        "অফারটি চালু হবে ১৩ তারিখ, অফার পেতে আমাদের টেলিগ্রাম চ্যানেলে চোখ রাখুন।",
        ...RULES_COMMON,
      ],
      options: [
        { label: "Weekly Offer", price: 158, sortOrder: 1 },
        { label: "Monthly Offer", price: 790, sortOrder: 2 },
      ],
    },
    {
      name: "Free Tournament",
      slug: "free-tournament",
      image: "/images/product_tournament.jpg",
      sectionId: specialOfferSection.id,
      type: "EXTERNAL_LINK" as const,
      externalUrl: "https://t.me/+K3PmqW02YCI2OGRl",
      sortOrder: 2,
      rules: [],
      options: [],
    },
    {
      name: "Uid Topup [BD SERVER]",
      slug: "uid-topup-bd-server",
      image: "/images/product_uid_bd.jpg",
      sectionId: freeFireSection.id,
      type: "NORMAL" as const,
      sortOrder: 1,
      rules: RULES_COMMON,
      options: [
        { label: "25 Diamond", price: 27, sortOrder: 1 },
        { label: "50 Diamond", price: 53, sortOrder: 2 },
        { label: "115 Diamond", price: 120, sortOrder: 3 },
        { label: "240 Diamond", price: 240, sortOrder: 4 },
        { label: "355 Diamond", price: 355, sortOrder: 5 },
        { label: "480 Diamond", price: 470, sortOrder: 6 },
        { label: "610 Diamond", price: 595, sortOrder: 7 },
        { label: "850 Diamond", price: 830, sortOrder: 8 },
        { label: "1090 Diamond", price: 1060, sortOrder: 9 },
        { label: "2200 Diamond", price: 2130, sortOrder: 10 },
      ],
    },
    {
      name: "Weekly/Monthly",
      slug: "weekly-monthly",
      image: "/images/product_weekly_monthly.jpg",
      sectionId: freeFireSection.id,
      type: "NORMAL" as const,
      sortOrder: 2,
      rules: RULES_COMMON,
      options: [
        { label: "Weekly Membership", price: 158, sortOrder: 1 },
        { label: "Monthly Membership", price: 790, sortOrder: 2 },
      ],
    },
    {
      name: "Lavel Up Pass",
      slug: "lavel-up-pass",
      image: "/images/product_level_up.jpg",
      sectionId: freeFireSection.id,
      type: "NORMAL" as const,
      sortOrder: 3,
      rules: RULES_COMMON,
      options: [{ label: "Level Up Pass", price: 260, sortOrder: 1 }],
    },
    {
      name: "Weekly Lite (BD Server)",
      slug: "weekly-lite-bd-server",
      image: "/images/product_weekly_lite.jpg",
      sectionId: freeFireSection.id,
      type: "NORMAL" as const,
      sortOrder: 4,
      rules: RULES_COMMON,
      options: [{ label: "Weekly Lite", price: 79, sortOrder: 1 }],
    },
    {
      name: "Free Fire Uid Topup [Indonesia]",
      slug: "free-fire-uid-topup-indonesia",
      image: "/images/product_indonesia.jpg",
      sectionId: freeFireSection.id,
      type: "NORMAL" as const,
      category: "Free Fire",
      sortOrder: 5,
      rules: [
        "শুধুমাত্র Indonesia সার্ভারের ID Code দিয়ে টপ আপ হবে।",
        ...RULES_COMMON.slice(1),
      ],
      options: [
        { label: "50 Diamond", price: 60, sortOrder: 1 },
        { label: "115 Diamond", price: 135, sortOrder: 2 },
        { label: "240 Diamond", price: 265, sortOrder: 3 },
        { label: "480 Diamond", price: 520, sortOrder: 4 },
        { label: "610 Diamond", price: 655, sortOrder: 5 },
      ],
    },
  ];

  for (const p of products) {
    const { options, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { ...productData, rules: productData.rules },
      create: { ...productData, rules: productData.rules },
    });

    await prisma.rechargeOption.deleteMany({ where: { productId: product.id } });
    if (options.length) {
      await prisma.rechargeOption.createMany({
        data: options.map((o) => ({ ...o, productId: product.id })),
      });
    }
  }

  console.log("Seeding admin user...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@topupshop.co";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      name: "Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
      walletBalance: 0,
    },
  });

  console.log(`Admin user ready: ${adminEmail} / ${adminPassword}`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
