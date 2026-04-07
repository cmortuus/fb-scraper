import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { SavedSearch, Deal } from "@/app/lib/microcenter";
import { buildDealEmailHtml } from "@/app/lib/microcenter";

const DATA_FILE = path.join(process.cwd(), "data", "saved-searches.json");

function load(): SavedSearch[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function save(searches: SavedSearch[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(searches, null, 2));
}

export async function POST(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const searches = load();
  const idx = searches.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const search = searches[idx];

  // Fetch deals
  const params = new URLSearchParams({
    storeIds: search.storeIds.join(","),
    minSavings: String(search.minSavings),
  });
  const baseUrl = new URL(req.url);
  let deals: Deal[];
  try {
    const dealRes = await fetch(`${baseUrl.protocol}//${baseUrl.host}/market/api/microcenter?${params}`);
    if (!dealRes.ok) {
      const err = await dealRes.json().catch(() => ({}));
      return NextResponse.json({ error: err.error ?? "Failed to fetch deals" }, { status: 502 });
    }
    ({ deals } = await dealRes.json());
  } catch {
    return NextResponse.json({ error: "Failed to reach MicroCenter API" }, { status: 502 });
  }

  const worthIt = (deals ?? []).filter((d) => d.worthIt);

  // Update lastRun
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

  const maxSavings = Math.max(...worthIt.map((d) => d.savingsPercent ?? 0));

  try {
    await transporter.sendMail({
      from: `"MicroCenter Deals" <${gmailUser}>`,
      to: search.email,
      subject: `🔥 ${worthIt.length} open box deal${worthIt.length > 1 ? "s" : ""} — up to ${maxSavings}% off · ${search.name}`,
      html: buildDealEmailHtml(
        worthIt,
        "MicroCenter Open Box Deals",
        `${search.name} · ${worthIt.length} deal${worthIt.length > 1 ? "s" : ""} found`
      ),
    });
  } catch {
    return NextResponse.json({ error: "Failed to send email — check GMAIL credentials", dealsFound: worthIt.length }, { status: 500 });
  }

  return NextResponse.json({ sent: true, dealsFound: worthIt.length });
}
