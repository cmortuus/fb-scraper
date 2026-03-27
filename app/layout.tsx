import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Used Finder",
  description: "Search for used items and open box deals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 flex gap-1 py-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Used Finder
            </Link>
            <Link
              href="/microcenter"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              MicroCenter Deals
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
