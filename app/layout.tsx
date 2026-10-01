import type { Metadata, Viewport } from "next";
import { Inter, Lobster_Two } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const script = Lobster_Two({ subsets: ["latin"], weight: "700", style: "italic", variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: "Kinta & Co. — The New African Icon",
  description: "Embrace your heritage, elevate your steeze. Tees, long sleeves, crewnecks and track hoodies from Kinta & Co.",
  openGraph: {
    title: "Kinta & Co. — The New African Icon",
    description: "Embrace your heritage, elevate your steeze.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dfdfdc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
