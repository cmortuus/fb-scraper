import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { Deal } from "@/app/lib/microcenter";

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

  const dealsHtml = worthItDeals
    .map(
      (d) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #eee;">
        ${d.imageUrl ? `<img src="${d.imageUrl}" width="80" style="border-radius:6px;" />` : ""}
      </td>
      <td style="padding:12px;border-bottom:1px solid #eee;">
        <a href="${d.url}" style="font-weight:600;color:#1d4ed8;text-decoration:none;">${d.title}</a><br/>
        <span style="color:#16a34a;font-size:1.1em;font-weight:700;">$${d.openBoxPrice} open box</span>
        ${d.originalPrice ? `<span style="color:#6b7280;margin-left:8px;text-decoration:line-through;">$${d.originalPrice}</span>` : ""}
        ${d.savingsPercent ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:0.85em;margin-left:8px;">${d.savingsPercent}% off${d.savingsAmount ? ` ($${d.savingsAmount} saved)` : ""}</span>` : ""}
      </td>
    </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1e293b;">MicroCenter Open Box Alert 🔥</h2>
      <p style="color:#475569;">Found ${worthItDeals.length} deal${worthItDeals.length > 1 ? "s" : ""} worth checking out:</p>
      <table style="width:100%;border-collapse:collapse;">
        ${dealsHtml}
      </table>
      <p style="color:#94a3b8;font-size:0.8em;margin-top:24px;">
        Prices are subject to change. Open box items sell fast — check availability before driving.
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"MicroCenter Deals" <${gmailUser}>`,
    to: recipient,
    subject: `🔥 ${worthItDeals.length} MicroCenter open box deal${worthItDeals.length > 1 ? "s" : ""} — up to ${Math.max(...worthItDeals.map((d) => d.savingsPercent ?? 0))}% off`,
    html,
  });

  return NextResponse.json({ sent: worthItDeals.length });
}
