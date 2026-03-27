export interface Category {
  label: string;
  craigslistCode: string;
  ebayCategoryId: string;
  keywords: string[];
}

// Claude uses these keywords to infer the category from a natural language description
export const CATEGORIES: Category[] = [
  {
    label: "Cars & Trucks",
    craigslistCode: "cta",
    ebayCategoryId: "6001",
    keywords: ["car", "truck", "sedan", "suv", "pickup", "van", "vehicle", "auto", "honda", "toyota", "ford", "chevy", "bmw", "mercedes", "audi"],
  },
  {
    label: "Motorcycles",
    craigslistCode: "mca",
    ebayCategoryId: "6024",
    keywords: ["motorcycle", "motorbike", "dirt bike", "harley", "kawasaki", "yamaha", "suzuki", "ducati"],
  },
  {
    label: "Gym Equipment",
    craigslistCode: "spo",
    ebayCategoryId: "15273",
    keywords: ["gym", "weights", "barbell", "dumbbell", "squat rack", "bench press", "treadmill", "elliptical", "peloton", "kettlebell", "cable machine", "pull up bar"],
  },
  {
    label: "Bicycles",
    craigslistCode: "bia",
    ebayCategoryId: "7294",
    keywords: ["bicycle", "bike", "road bike", "mountain bike", "ebike", "electric bike", "trek", "specialized"],
  },
  {
    label: "Furniture",
    craigslistCode: "fua",
    ebayCategoryId: "3197",
    keywords: ["couch", "sofa", "chair", "table", "desk", "dresser", "bed", "mattress", "bookshelf", "cabinet", "furniture"],
  },
  {
    label: "Electronics",
    craigslistCode: "ela",
    ebayCategoryId: "293",
    keywords: ["tv", "television", "laptop", "computer", "iphone", "phone", "ipad", "tablet", "camera", "monitor", "headphones", "speaker"],
  },
  {
    label: "Tools",
    craigslistCode: "tla",
    ebayCategoryId: "631",
    keywords: ["drill", "saw", "tool", "wrench", "power tool", "compressor", "generator", "welder", "grinder"],
  },
  {
    label: "Musical Instruments",
    craigslistCode: "msg",
    ebayCategoryId: "619",
    keywords: ["guitar", "piano", "keyboard", "drum", "bass", "violin", "saxophone", "trumpet", "synthesizer", "amp", "amplifier"],
  },
  {
    label: "Outdoor & Garden",
    craigslistCode: "grd",
    ebayCategoryId: "159912",
    keywords: ["lawn mower", "leaf blower", "garden", "patio", "grill", "bbq", "outdoor furniture", "shed", "tractor"],
  },
  {
    label: "General / Other",
    craigslistCode: "for",
    ebayCategoryId: "99",
    keywords: [],
  },
];

export function getCategoryByLabel(label: string): Category {
  return CATEGORIES.find((c) => c.label === label) ?? CATEGORIES[CATEGORIES.length - 1];
}
