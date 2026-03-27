# Used Finder — Setup

Search for used items with natural language. Works for cars, gym equipment, furniture, electronics, and more. Searches Craigslist, eBay, and links to Facebook Marketplace.

## Quick Start

### 1. Install Node.js (one time)
```bash
brew install node
```

### 2. Install dependencies
```bash
cd used-finder
npm install
```

### 3. Add your API keys
Copy the example env file and fill it in:
```bash
cp .env.local.example .env.local
```
Open `.env.local` and add:
- **ANTHROPIC_API_KEY** — required. Get at https://console.anthropic.com
- **EBAY_APP_ID** — optional but recommended. Get at https://developer.ebay.com/my/keys (free)

### 4. Run it
```bash
npm run dev
```
Open http://localhost:3000

---

## Deploy (share with anyone, no install needed)

```bash
npm install -g vercel
vercel deploy
```
Follow the prompts. It will ask you to add your env vars (`ANTHROPIC_API_KEY`, `EBAY_APP_ID`) in the Vercel dashboard.

You'll get a URL like `https://used-finder-xyz.vercel.app` that anyone can open in a browser.

---

## How it works

1. You type a description like *"used squat rack under $300 near Seattle"*
2. Claude AI parses it into: keywords, category, price range, location
3. The app searches Craigslist (via RSS) and eBay (via API) in parallel
4. Results are merged and sorted by price
5. A Facebook Marketplace search link is also generated

## Supported categories

Cars & Trucks · Motorcycles · Gym Equipment · Bicycles · Furniture · Electronics · Tools · Musical Instruments · Outdoor & Garden · General
