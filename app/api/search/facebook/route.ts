import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import path from "path";
import os from "os";
import type { Listing } from "@/app/lib/types";
import { CITY_TO_FB } from "@/app/lib/cities";

// Use the user's real Chrome profile so they're already logged into Facebook
const CHROME_USER_DATA = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome"
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get("keywords") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const radiusMiles = searchParams.get("radiusMiles") ?? "";
  const location = searchParams.get("location") ?? "";

  const locationKey = location.toLowerCase().trim();
  const fbCity = CITY_TO_FB[locationKey];

  const params = new URLSearchParams({ query: keywords });
  if (minPrice) params.set("minPrice", minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (radiusMiles) {
    params.set("exact_radius", radiusMiles);
    params.set("radius_unit", "imperial");
  }

  // Use city-specific URL if we know the slug, otherwise fall back to generic search
  const base = fbCity
    ? `https://www.facebook.com/marketplace/${fbCity}/search`
    : "https://www.facebook.com/marketplace/search";
  const url = `${base}?${params.toString()}`;

  let browser;
  try {
    browser = await chromium.launchPersistentContext(CHROME_USER_DATA, {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
      channel: "chrome", // use system Chrome if available, else playwright chromium
    });
  } catch {
    // Fallback: launch without user profile if Chrome isn't installed
    browser = await chromium.launchPersistentContext(
      path.join(os.tmpdir(), "fb-marketplace-session"),
      {
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      }
    );
  }

  try {
    const page = browser.pages()[0] ?? (await browser.newPage());

    // Remove webdriver flag so Facebook doesn't detect automation
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Dismiss login dialog if present (click outside or close button)
    try {
      await page.locator('[aria-label="Close"]').first().click({ timeout: 3000 });
    } catch {}

    // Wait for listing items to appear
    try {
      await page.waitForSelector('[data-pagelet="MarketplaceSearchResults"] a', {
        timeout: 10000,
      });
    } catch {
      // Try alternate selector
      await page.waitForSelector('a[href*="/marketplace/item/"]', {
        timeout: 8000,
      });
    }

    // Scroll multiple times to load more listings
    for (let s = 0; s < 6; s++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(1000);
    }

    // Extract listings
    const listings: Listing[] = await page.evaluate(() => {
      const results: Listing[] = [];
      const seen = new Set<string>();

      // Find all marketplace item links
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/marketplace/item/"]'));
      for (const a of links) {
        if (results.length >= 60) break;
        const href = a.href.split("?")[0];
        if (seen.has(href)) continue;
        seen.add(href);

        const img = a.querySelector<HTMLImageElement>("img");
        const spans = Array.from(a.querySelectorAll("span"));

        // Price is usually the first span that starts with $
        const priceSpan = spans.find((s) => s.textContent?.trim().startsWith("$"));
        const priceText = priceSpan?.textContent?.trim() ?? "";
        const priceMatch = priceText.match(/[\d,]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : null;

        // Title is usually the longest non-price span
        const titleSpan = spans
          .filter((s) => !s.textContent?.startsWith("$") && (s.textContent?.length ?? 0) > 5)
          .sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
        const title = titleSpan?.textContent?.trim() ?? "Facebook Marketplace listing";

        // Location span (usually contains city name)
        const locationSpan = spans.find(
          (s) =>
            s !== priceSpan &&
            s !== titleSpan &&
            (s.textContent?.length ?? 0) > 2 &&
            (s.textContent?.length ?? 0) < 50
        );

        results.push({
          id: `fb-${results.length}`,
          title,
          price,
          imageUrl: img?.src ?? null,
          location: locationSpan?.textContent?.trim() ?? "Facebook Marketplace",
          postedAt: null,
          sourceUrl: href,
          source: "facebook" as const,
        });
      }

      return results;
    });

    console.log(`[Facebook] fetched ${listings.length} raw listings from: ${url}`);
    return NextResponse.json({ listings, url, rawCount: listings.length });
  } catch (err) {
    console.error("Facebook scrape error:", err);
    return NextResponse.json({
      listings: [],
      error: `Could not scrape Facebook Marketplace: ${err instanceof Error ? err.message : "unknown error"}`,
      url,
    });
  } finally {
    await browser.close();
  }
}
