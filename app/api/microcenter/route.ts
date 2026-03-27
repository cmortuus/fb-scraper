import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import path from "path";
import os from "os";
import Anthropic from "@anthropic-ai/sdk";
import type { Deal } from "@/app/lib/microcenter";
import { STORE_NAMES, DEFAULT_STORE_IDS } from "@/app/lib/microcenter";

const CHROME_USER_DATA = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
const client = new Anthropic();

type RawItem = {
  title: string;
  openBoxPriceText: string;
  originalPriceText: string;
  url: string;
  imageUrl: string | null;
  sku: string | null;
};

async function scrapeStore(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  storeId: string
): Promise<RawItem[]> {
  const url = `https://www.microcenter.com/search/search_results.aspx?Ntk=all&N=4294966996&storeid=${storeId}&myStore=false&paging_mode=1&sortby=6`;
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    try {
      await page.waitForSelector("#productGrid li, .product_wrapper", { timeout: 10000 });
    } catch { /* continue */ }

    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 1200));
      await page.waitForTimeout(600);
    }

    const items: RawItem[] = await page.evaluate(() => {
      const results: RawItem[] = [];
      const containers = Array.from(document.querySelectorAll("#productGrid li, .product_wrapper"));

      containers.forEach((el) => {
        const titleEl =
          el.querySelector("h2 a") ??
          el.querySelector(".product-title a") ??
          el.querySelector("a.productClickItemV2");
        const title = titleEl?.textContent?.trim() ?? "";
        if (!title) return;

        const href = titleEl?.getAttribute("href") ?? "";
        const fullUrl = href.startsWith("http") ? href : `https://www.microcenter.com${href}`;

        const img = el.querySelector<HTMLImageElement>("img");
        const imageUrl = img?.src ?? img?.dataset?.src ?? null;

        const priceEl =
          el.querySelector(".pricediv .price") ??
          el.querySelector("span.price") ??
          el.querySelector(".price-box .price") ??
          el.querySelector("[class*='price']:not([class*='was']):not([class*='original'])");
        const openBoxPriceText = priceEl?.textContent?.trim() ?? "";

        const wasEl =
          el.querySelector(".was-price") ??
          el.querySelector(".original-price") ??
          el.querySelector("s") ??
          el.querySelector("del") ??
          el.querySelector(".strike") ??
          el.querySelector("[class*='was']") ??
          el.querySelector("[class*='original']");
        const originalPriceText = wasEl?.textContent?.trim() ?? "";

        const skuEl = el.querySelector("[data-id], [data-sku]");
        const sku = skuEl?.getAttribute("data-id") ?? skuEl?.getAttribute("data-sku") ?? null;

        results.push({ title, openBoxPriceText, originalPriceText, url: fullUrl, imageUrl, sku });
      });

      return results;
    });

    console.log(`[MicroCenter] store ${storeId}: ${items.length} raw items`);
    return items;
  } finally {
    await page.close();
  }
}

function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeIdsParam = searchParams.get("storeIds") ?? DEFAULT_STORE_IDS.join(",");
  const storeIds = storeIdsParam.split(",").filter(Boolean);
  const minSavings = parseInt(searchParams.get("minSavings") ?? "20");

  let context;
  try {
    context = await chromium.launchPersistentContext(CHROME_USER_DATA, {
      headless: true,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
      ignoreDefaultArgs: ["--enable-automation"],
      channel: "chrome",
    });
  } catch {
    context = await chromium.launchPersistentContext(
      path.join(os.tmpdir(), "mc-session"),
      { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
    );
  }

  let allRaw: Array<RawItem & { storeId: string }> = [];

  try {
    // Scrape stores sequentially in the same browser context
    for (const storeId of storeIds) {
      try {
        const items = await scrapeStore(context, storeId);
        allRaw = allRaw.concat(items.map((i) => ({ ...i, storeId })));
      } catch (err) {
        console.error(`[MicroCenter] store ${storeId} failed:`, err);
      }
    }
  } finally {
    await context.close();
  }

  const rawCount = allRaw.length;

  // Parse and deduplicate by title (same item across stores → keep cheapest)
  const byTitle = new Map<string, typeof allRaw[0]>();
  for (const item of allRaw) {
    const key = item.title.toLowerCase().trim();
    const existing = byTitle.get(key);
    const price = parsePrice(item.openBoxPriceText) ?? Infinity;
    const existingPrice = existing ? (parsePrice(existing.openBoxPriceText) ?? Infinity) : Infinity;
    if (!existing || price < existingPrice) {
      byTitle.set(key, item);
    }
  }
  const deduped = Array.from(byTitle.values());

  const withPrices = deduped
    .map((item) => {
      const openBoxPrice = parsePrice(item.openBoxPriceText);
      const originalPrice = parsePrice(item.originalPriceText);
      const savingsPercent =
        openBoxPrice && originalPrice && originalPrice > openBoxPrice
          ? Math.round(((originalPrice - openBoxPrice) / originalPrice) * 100)
          : null;
      const savingsAmount =
        openBoxPrice && originalPrice && originalPrice > openBoxPrice
          ? Math.round(originalPrice - openBoxPrice)
          : null;
      return {
        title: item.title,
        openBoxPrice,
        originalPrice,
        savingsPercent,
        savingsAmount,
        url: item.url,
        imageUrl: item.imageUrl,
        sku: item.sku,
        storeId: item.storeId,
        store: STORE_NAMES[item.storeId] ?? item.storeId,
      };
    })
    .filter((d) => d.openBoxPrice !== null && d.openBoxPrice > 0);

  if (withPrices.length === 0) {
    return NextResponse.json({
      deals: [],
      rawCount,
      error: "No priced items found — MicroCenter page structure may have changed or store IDs are incorrect",
    });
  }

  // Claude filter
  const titlesText = withPrices
    .map((d, i) =>
      `${i}: "${d.title}" [${d.store}] — Open box: $${d.openBoxPrice}, Original: $${d.originalPrice ?? "?"}, Savings: ${d.savingsPercent ?? "?"}%`
    )
    .join("\n");

  let worthItFlags: boolean[] = withPrices.map(() => true);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [
        {
          name: "classify_deals",
          description: "Classify which items are worth buying open box",
          input_schema: {
            type: "object" as const,
            properties: {
              worth_it_indices: {
                type: "array",
                items: { type: "number" },
                description: "Indices of items worth buying open box. Exclude cables, mouse pads, cheap accessories, anything under $30, trivial savings.",
              },
            },
            required: ["worth_it_indices"],
          },
        },
      ],
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content: `Evaluate these MicroCenter open box deals. Flag only items genuinely worth driving to the store for.

INCLUDE: GPUs, CPUs, laptops, monitors, SSDs, RAM, motherboards, cases, PSUs, keyboards, mice, headsets — with meaningful savings.
EXCLUDE: cables, adapters, mouse pads, cleaning supplies, zip ties, anything under $30, trivial savings (<$10).

Worth it = substantive tech item + open box price > $30 + (savings >= ${minSavings}% OR savings amount >= $40).

Items:
${titlesText}`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      const { worth_it_indices } = toolUse.input as { worth_it_indices: number[] };
      worthItFlags = withPrices.map((_, i) => worth_it_indices.includes(i));
    }
  } catch (err) {
    console.error("[MicroCenter] Claude filter error:", err);
  }

  const deals: Deal[] = withPrices.map((item, i) => ({
    ...item,
    openBoxPrice: item.openBoxPrice!,
    worthIt: worthItFlags[i],
  }));

  deals.sort((a, b) => {
    if (a.worthIt !== b.worthIt) return a.worthIt ? -1 : 1;
    return (b.savingsPercent ?? 0) - (a.savingsPercent ?? 0);
  });

  console.log(`[MicroCenter] ${deals.length} deals, ${deals.filter((d) => d.worthIt).length} worth it`);
  return NextResponse.json({ deals, rawCount });
}
