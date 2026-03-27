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
