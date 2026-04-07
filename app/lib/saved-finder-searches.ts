import type { Listing } from "./types";

export interface SavedFinderSearch {
  id: string;
  name: string;
  description: string; // the natural language search query
  email: string;
  location?: string;
  radiusMiles?: number;
  createdAt: string;
  lastRun?: string;
  lastResultCount?: number;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildListingEmailHtml(
  listings: Listing[],
  title: string,
  subtitle: string
): string {
  const listingsHtml = listings
    .map(
      (l) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #333;width:80px;vertical-align:top;">
        ${l.imageUrl ? `<img src="${escapeHtml(l.imageUrl)}" width="80" style="border-radius:6px;" />` : ""}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #333;vertical-align:top;">
        <a href="${escapeHtml(l.sourceUrl)}" style="font-weight:600;color:#818cf8;text-decoration:none;font-size:14px;">${escapeHtml(l.title)}</a><br/>
        <span style="color:#34d399;font-size:1.1em;font-weight:700;">${l.price != null ? `$${l.price.toLocaleString()}` : "Price N/A"}</span>
        <br/><span style="color:#9ca3af;font-size:12px;margin-top:4px;display:block;">${escapeHtml(l.location)} · ${l.source === "ebay" ? "eBay" : l.source === "facebook" ? "Facebook" : "Craigslist"}</span>
      </td>
    </tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111827;color:#f3f4f6;padding:24px;border-radius:12px;">
      <h2 style="color:#f3f4f6;margin-bottom:4px;">${escapeHtml(title)}</h2>
      <p style="color:#9ca3af;margin-top:0;">${escapeHtml(subtitle)}</p>
      <table style="width:100%;border-collapse:collapse;">${listingsHtml}</table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        Listings change quickly — check them out before they're gone.
      </p>
    </div>`;
}
