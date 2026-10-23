import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#eeefeb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
