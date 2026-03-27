import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { SavedSearch, Deal } from "@/app/lib/microcenter";

const DATA_FILE = path.join(process.cwd(), "data", "saved-searches.json");

function load(): SavedSearch[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function save(searches: SavedSearch[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(searches, null, 2));
}

export async function POST(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const searches = load();
  const search = searches.find((s) => s.id === id);
  if (!search) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch deals
  const params = new URLSearchParams({
    storeIds: search.storeIds.join(","),
    minSavings: String(search.minSavings),
  });
  const baseUrl = new URL(req.url);
  const dealRes = await fetch(`${baseUrl.protocol}//${baseUrl.host}/api/microcenter?${params}`);
  const { deals }: { deals: Deal[] } = await dealRes.json();

  const worthIt = (deals ?? []).filter((d) => d.worthIt);

  // Update lastRun
  const idx = searches.findIndex((s) => s.id === id);
  searches[idx].lastRun = new Date().toISOString();
  searches[idx].lastDealsFound = worthIt.length;
  save(searches);

  if (worthIt.length === 0) {
    return NextResponse.json({ sent: false, dealsFound: 0, message: "No deals worth alerting" });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      error: "Email not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local",
      dealsFound: worthIt.length,
    }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  const dealsHtml = worthIt
    .map(
      (d) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;width:80px;vertical-align:top;">
        ${d.imageUrl ? `<img src="${d.imageUrl}" width="80" style="border-radius:6px;" />` : ""}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;">
        <a href="${d.url}" style="font-weight:600;color:#1d4ed8;text-decoration:none;font-size:14px;">${d.title}</a><br/>
        <span style="color:#16a34a;font-size:1.1em;font-weight:700;">$${d.openBoxPrice} open box</span>
        ${d.originalPrice ? `<span style="color:#9ca3af;margin-left:8px;text-decoration:line-through;font-size:13px;">$${d.originalPrice}</span>` : ""}
        ${d.savingsPercent ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;margin-left:8px;">${d.savingsPercent}% off${d.savingsAmount ? ` · save $${d.savingsAmount}` : ""}</span>` : ""}
        <br/><span style="color:#9ca3af;font-size:12px;margin-top:4px;display:block;">${d.store}</span>
      </td>
    </tr>`
    )
    .join("");

  const maxSavings = Math.max(...worthIt.map((d) => d.savingsPercent ?? 0));

  await transporter.sendMail({
    from: `"MicroCenter Deals" <${gmailUser}>`,
    to: search.email,
    subject: `🔥 ${worthIt.length} open box deal${worthIt.length > 1 ? "s" : ""} — up to ${maxSavings}% off · ${search.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1e293b;margin-bottom:4px;">MicroCenter Open Box Deals</h2>
        <p style="color:#64748b;margin-top:0;">${search.name} · ${worthIt.length} deal${worthIt.length > 1 ? "s" : ""} found</p>
        <table style="width:100%;border-collapse:collapse;">${dealsHtml}</table>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
          Open box items sell fast — call ahead or check microcenter.com for current availability.
        </p>
      </div>`,
  });

  return NextResponse.json({ sent: true, dealsFound: worthIt.length });
}
