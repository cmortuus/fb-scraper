import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import path from "path";
import os from "os";
import { withPlaywrightLock } from "@/app/lib/playwright-lock";

const BRAVE_USER_DATA = path.join(
  os.homedir(),
  "Library/Application Support/BraveSoftware/Brave-Browser"
);
const BRAVE_EXECUTABLE =
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

export async function POST(req: NextRequest) {
  const { listingUrl, message } = await req.json();

  if (!listingUrl || !message?.trim()) {
    return NextResponse.json(
      { error: "listingUrl and message are required" },
      { status: 400 }
    );
  }

  if (!listingUrl.includes("facebook.com/marketplace/item/")) {
    return NextResponse.json(
      { error: "Only Facebook Marketplace listings are supported" },
      { status: 400 }
    );
  }

  return withPlaywrightLock(async () => {
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
      return NextResponse.json(
        { error: "Could not launch browser. Make sure Brave is closed." },
        { status: 500 }
      );
    }

    try {
      const page = browser.pages()[0] ?? (await browser.newPage());

      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      // Navigate to the listing
      await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Dismiss login dialog if present
      try {
        await page.locator('[aria-label="Close"]').first().click({ timeout: 3000 });
      } catch {}

      // Wait for the page to load
      await page.waitForTimeout(2000);

      // Find and click the "Message" or "Send Message" button
      const messageButton = page.locator(
        'div[aria-label="Send seller a message"], ' +
        'div[aria-label="Message"], ' +
        'span:text-is("Message"), ' +
        'span:text-is("Send Message"), ' +
        'span:text-is("Is this still available?")'
      ).first();

      try {
        await messageButton.click({ timeout: 5000 });
      } catch {
        // Try clicking any prominent CTA button on the listing
        const fallback = page.locator(
          '[role="button"]:has(span:text-matches("message|Message|Send|send", "i"))'
        ).first();
        await fallback.click({ timeout: 5000 });
      }

      await page.waitForTimeout(1500);

      // Find the message input and clear any pre-filled text, then type the custom message
      const messageInput = page.locator(
        'div[role="textbox"][contenteditable="true"], ' +
        'textarea[name="message"], ' +
        'div[aria-label*="Message"]'
      ).first();

      await messageInput.click({ timeout: 5000 });

      // Select all existing text and replace with our message
      await page.keyboard.press("Meta+a");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(message, { delay: 30 });

      await page.waitForTimeout(500);

      // Click send button
      const sendButton = page.locator(
        'div[aria-label="Send message"], ' +
        'div[aria-label="Send"], ' +
        '[role="button"]:has(span:text-is("Send")), ' +
        '[role="button"]:has(span:text-is("Send message"))'
      ).first();

      await sendButton.click({ timeout: 5000 });

      // Wait for message to be sent
      await page.waitForTimeout(2000);

      console.log(`[FB Message] Sent message to: ${listingUrl}`);
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("FB message error:", err);
      return NextResponse.json(
        {
          error: `Failed to send message: ${err instanceof Error ? err.message : "unknown error"}`,
        },
        { status: 500 }
      );
    } finally {
      await browser.close();
    }
  });
}
