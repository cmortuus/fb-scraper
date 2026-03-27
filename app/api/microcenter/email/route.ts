import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { Deal } from "@/app/lib/microcenter";
import { buildDealEmailHtml } from "@/app/lib/microcenter";

export async function POST(req: NextRequest) {
  const { deals, toEmail } = await req.json() as { deals: Deal[]; toEmail: string };

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const recipient = toEmail || process.env.ALERT_EMAIL;

  if (!gmailUser || !gmailPass) {
    return NextResponse.json(
      { error: "Email not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local" },
      { status: 400 }
    );
  }
  if (!recipient) {
    return NextResponse.json({ error: "No recipient email provided" }, { status: 400 });
  }

  const worthItDeals = deals.filter((d) => d.worthIt);
  if (worthItDeals.length === 0) {
    return NextResponse.json({ message: "No deals worth alerting about" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  const maxSavings = Math.max(...worthItDeals.map((d) => d.savingsPercent ?? 0));
  const html = buildDealEmailHtml(
    worthItDeals,
    "MicroCenter Open Box Deals",
    `${worthItDeals.length} deal${worthItDeals.length > 1 ? "s" : ""} found`
  );

  await transporter.sendMail({
    from: `"MicroCenter Deals" <${gmailUser}>`,
    to: recipient,
    subject: `🔥 ${worthItDeals.length} MicroCenter open box deal${worthItDeals.length > 1 ? "s" : ""} — up to ${maxSavings}% off`,
    html,
  });

  return NextResponse.json({ sent: worthItDeals.length });
}
