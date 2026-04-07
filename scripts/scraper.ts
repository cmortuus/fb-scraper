import { chromium } from "playwright";
import pg from "pg";
import path from "path";
import os from "os";

// --- Config ---
const CITY = "baltimore";
const CATEGORIES = ["", "vehicles", "sports", "electronics"]; // "" = all
const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const JITTER_MS = 30_000; // 30-60s random delay between scrapes

const BRAVE_USER_DATA = path.join(
  os.homedir(),
  "Library/Application Support/BraveSoftware/Brave-Browser"
);
const BRAVE_EXECUTABLE =
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

// Connects via SSH tunnel: ssh -L 5433:localhost:5432 root@lethal.dev
// (the db container maps to localhost inside the VPS)
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface RawListing {
  fb_id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  location: string;
  source_url: string;
}

async function scrapeFB(
  city: string,
  category: string
): Promise<RawListing[]> {
  const segments = ["marketplace", city];
  if (category) segments.push(category);
  const url = `https://www.facebook.com/${segments.join("/")}`;

  let browser;
  try {
    browser = await chromium.launchPersistentContext(BRAVE_USER_DATA, {
      headless: true,
      executablePath: BRAVE_EXECUTABLE,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
  } catch {
    browser = await chromium.launchPersistentContext(
      path.join(os.tmpdir(), "fb-marketplace-session"),
      { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
    );
  }

  try {
    const page = browser.pages()[0] ?? (await browser.newPage());

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Dismiss login dialog
    try {
      await page
        .locator('[aria-label="Close"]')
        .first()
        .click({ timeout: 3000 });
    } catch {}

    // Wait for listings
    try {
      await page.waitForSelector('a[href*="/marketplace/item/"]', {
        timeout: 12000,
      });
    } catch {}

    // Scroll to load listings
    for (let s = 0; s < 8; s++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(1000);
    }

    const listings: RawListing[] = await page.evaluate(() => {
      const results: RawListing[] = [];
      const seen = new Set<string>();
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="/marketplace/item/"]'
        )
      );

      for (const a of links) {
        if (results.length >= 60) break;
        const href = a.href.split("?")[0];
        if (seen.has(href)) continue;
        seen.add(href);

        // Extract fb_id from URL like /marketplace/item/123456/
        const idMatch = href.match(/\/marketplace\/item\/(\d+)/);
        if (!idMatch) continue;

        const img = a.querySelector<HTMLImageElement>("img");
        const spans = Array.from(a.querySelectorAll("span"));

        const priceSpan = spans.find((s) =>
          s.textContent?.trim().startsWith("$")
        );
        const priceText = priceSpan?.textContent?.trim() ?? "";
        const priceMatch = priceText.match(/[\d,]+/);
        const price = priceMatch
          ? parseFloat(priceMatch[0].replace(/,/g, ""))
          : null;

        const titleSpan = spans
          .filter(
            (s) =>
              !s.textContent?.startsWith("$") &&
              (s.textContent?.length ?? 0) > 5
          )
          .sort(
            (a, b) =>
              (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0)
          )[0];
        const title =
          titleSpan?.textContent?.trim() ?? "Facebook Marketplace listing";

        const locationSpan = spans.find(
          (s) =>
            s !== priceSpan &&
            s !== titleSpan &&
            (s.textContent?.length ?? 0) > 2 &&
            (s.textContent?.length ?? 0) < 50
        );

        results.push({
          fb_id: idMatch[1],
          title,
          price,
          image_url: img?.src ?? null,
          location:
            locationSpan?.textContent?.trim() ?? "Facebook Marketplace",
          source_url: href,
        });
      }

      return results;
    });

    return listings;
  } finally {
    await browser.close();
  }
}

async function upsertListings(
  listings: RawListing[],
  city: string,
  category: string
) {
  if (listings.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const l of listings) {
      await client.query(
        `INSERT INTO fb_listings (fb_id, title, price, image_url, location, source_url, city, category, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (fb_id) DO UPDATE SET
           title = EXCLUDED.title,
           price = EXCLUDED.price,
           image_url = EXCLUDED.image_url,
           location = EXCLUDED.location,
           scraped_at = NOW()`,
        [
          l.fb_id,
          l.title,
          l.price,
          l.image_url,
          l.location,
          l.source_url,
          city,
          category,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function cleanOldListings() {
  const result = await pool.query(
    "DELETE FROM fb_listings WHERE scraped_at < NOW() - INTERVAL '24 hours'"
  );
  if ((result.rowCount ?? 0) > 0) {
    console.log(`  Cleaned ${result.rowCount} old listings`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomJitter() {
  return JITTER_MS + Math.random() * JITTER_MS; // 30-60s
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function runCycle() {
  const categories = shuffle(CATEGORIES);
  console.log(
    `\n[${new Date().toLocaleTimeString()}] Starting scrape cycle for ${CITY}`
  );

  for (const cat of categories) {
    const label = cat || "all";
    console.log(`  Scraping ${CITY}/${label}...`);

    try {
      const listings = await scrapeFB(CITY, cat);
      console.log(`  Got ${listings.length} listings`);
      await upsertListings(listings, CITY, cat);
      console.log(`  Upserted to DB`);
    } catch (err) {
      console.error(
        `  Error scraping ${label}:`,
        err instanceof Error ? err.message : err
      );
    }

    // Jitter between scrapes
    const delay = randomJitter();
    console.log(`  Waiting ${Math.round(delay / 1000)}s before next...`);
    await sleep(delay);
  }

  await cleanOldListings();
  console.log(`[${new Date().toLocaleTimeString()}] Cycle complete`);
}

async function main() {
  console.log("FB Marketplace Scraper starting");
  console.log(`City: ${CITY}`);
  console.log(`Categories: ${CATEGORIES.map((c) => c || "all").join(", ")}`);
  console.log(`Interval: ${CYCLE_INTERVAL_MS / 60000} minutes`);
  console.log(`DB: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);

  // Test DB connection
  try {
    await pool.query("SELECT 1");
    console.log("DB connection OK\n");
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }

  // Run immediately, then loop
  while (true) {
    const start = Date.now();
    await runCycle();
    const elapsed = Date.now() - start;
    const wait = Math.max(0, CYCLE_INTERVAL_MS - elapsed);
    if (wait > 0) {
      console.log(
        `Sleeping ${Math.round(wait / 60000)} min until next cycle...`
      );
      await sleep(wait);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
