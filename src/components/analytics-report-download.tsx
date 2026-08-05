"use client";

import type { AnalyticsData } from "@/lib/analytics";

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export function AnalyticsReportDownload({ data }: { data: AnalyticsData }) {
  function handleDownload() {
    const sections: (string | number)[][] = [
      ["রিপোর্ট", data.periodLabel],
      ["তৈরি হয়েছে", new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })],
      [],
      ["সারসংক্ষেপ"],
      ["মেট্রিক", "মান"],
      ["মোট অর্ডার", data.stats.totalOrders],
      ["ডেলিভারড রেভিনিউ (৳)", data.stats.deliveredRevenue],
      ["গড় অর্ডার ভ্যালু (৳)", data.stats.avgOrderValue],
      ["নতুন ইউজার", data.stats.newUsers],
      ["এই মুহূর্তে পেন্ডিং অর্ডার", data.liveBacklog.pendingOrders],
      ["এই মুহূর্তে পেন্ডিং ওয়ালেট রিকোয়েস্ট", data.liveBacklog.pendingWalletRequests],
      [],
      ["ট্রেন্ড (" + (data.trendGranularity === "day" ? "দৈনিক" : "মাসিক") + ")"],
      ["সময়", "রেভিনিউ (৳)", "অর্ডার", "নতুন ইউজার"],
      ...data.trend.map((p) => [p.label, p.revenue, p.orders, p.newUsers]),
      [],
      ["অর্ডার স্ট্যাটাস ব্রেকডাউন"],
      ["স্ট্যাটাস", "সংখ্যা"],
      ...data.statusBreakdown.map((s) => [s.status, s.count]),
      [],
      ["শীর্ষ প্রোডাক্ট"],
      ["প্রোডাক্ট", "রেভিনিউ (৳)", "অর্ডার"],
      ...data.topProducts.map((p) => [p.name, p.revenue, p.orders]),
      [],
      ["পেমেন্ট মেথড ব্রেকডাউন"],
      ["মেথড", "পরিমাণ (৳)", "সংখ্যা"],
      ...data.paymentBreakdown.map((p) => [p.method, p.amount, p.count]),
      [],
      ["পারফরম্যান্স পরামর্শ"],
      ...data.advice.map((a) => [a.level, a.text]),
    ];

    // BOM prefix keeps Bangla text readable when the CSV is opened in Excel.
    const csv = "﻿" + toCsv(sections);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-report-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-primary-500 hover:text-primary-600"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
      </svg>
      রিপোর্ট ডাউনলোড করুন
    </button>
  );
}
