export interface Listing {
  id: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  location: string;
  postedAt: string | null;
  sourceUrl: string;
  source: "craigslist" | "ebay" | "facebook";
  description?: string;
}

export interface SearchParams {
  keywords: string;
  craigslistCategory: string;
  ebayCategoryId: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  condition?: string;
  radiusMiles?: number;
}

export interface SearchResults {
  craigslist: Listing[];
  ebay: Listing[];
  fbUrl: string;
  clUrl: string;
  params: SearchParams;
}
