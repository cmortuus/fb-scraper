import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "Used Finder",
  description: "Browse Facebook Marketplace and search for used items",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Used Finder",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 flex gap-1 py-2 overflow-x-auto no-scrollbar">
            <NavLinks />
          </div>
        </nav>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/market/sw.js'))}`,
          }}
        />
      </body>
    </html>
  );
}
