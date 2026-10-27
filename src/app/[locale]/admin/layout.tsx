import type { Metadata } from "next";

// The dashboard and its login/preview pages must never show up in search
// results. robots.txt only blocks crawling — a blocked URL can still be
// indexed from links — so they also carry an explicit noindex.
export const metadata: Metadata = {
  title: "Admin",
  // No canonical/hreflang inherited from the public home page.
  alternates: {},
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
