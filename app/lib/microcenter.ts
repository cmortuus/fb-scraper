export interface Deal {
  title: string;
  openBoxPrice: number;
  originalPrice: number | null;
  savingsPercent: number | null;
  savingsAmount: number | null;
  url: string;
  imageUrl: string | null;
  sku: string | null;
  worthIt: boolean;
  store: string; // which store this came from
}

export interface SavedSearch {
  id: string;
  name: string;
  storeIds: string[];
  minSavings: number;
  email: string;
  createdAt: string;
  lastRun?: string;
  lastDealsFound?: number;
}

// MicroCenter stores — storeId appears in the URL when you pick "My Store" on microcenter.com
export const STORES: Record<string, string> = {
  "Rockville, MD": "085",
  "Parkville, MD": "151",
  "Fairfax, VA": "164",
  "Cambridge, MA": "010",
  "Westmont, IL": "055",
  "Tustin, CA": "029",
  "Mayfield Heights, OH": "121",
  "Dallas, TX": "065",
  "Denver, CO": "044",
  "Yonkers, NY": "025",
  "Duluth, GA": "171",
  "Madison Heights, MI": "030",
  "Overland Park, KS": "075",
};

// Reverse map: id → name
export const STORE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STORES).map(([name, id]) => [id, name])
);

// Default stores for this region
export const DEFAULT_STORE_IDS = ["085", "151", "164"];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDealEmailHtml(deals: Deal[], title: string, subtitle: string): string {
  const dealsHtml = deals
    .map(
      (d) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;width:80px;vertical-align:top;">
        ${d.imageUrl ? `<img src="${escapeHtml(d.imageUrl)}" width="80" style="border-radius:6px;" />` : ""}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;">
        <a href="${escapeHtml(d.url)}" style="font-weight:600;color:#1d4ed8;text-decoration:none;font-size:14px;">${escapeHtml(d.title)}</a><br/>
        <span style="color:#16a34a;font-size:1.1em;font-weight:700;">$${d.openBoxPrice} open box</span>
        ${d.originalPrice ? `<span style="color:#9ca3af;margin-left:8px;text-decoration:line-through;font-size:13px;">$${d.originalPrice}</span>` : ""}
        ${d.savingsPercent ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;margin-left:8px;">${d.savingsPercent}% off${d.savingsAmount ? ` · save $${d.savingsAmount}` : ""}</span>` : ""}
        <br/><span style="color:#9ca3af;font-size:12px;margin-top:4px;display:block;">${escapeHtml(d.store)}</span>
      </td>
    </tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1e293b;margin-bottom:4px;">${escapeHtml(title)}</h2>
      <p style="color:#64748b;margin-top:0;">${escapeHtml(subtitle)}</p>
      <table style="width:100%;border-collapse:collapse;">${dealsHtml}</table>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        Open box items sell fast — call ahead or check microcenter.com for current availability.
      </p>
    </div>`;
}
