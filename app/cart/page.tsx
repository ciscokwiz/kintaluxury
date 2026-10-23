import type { Metadata } from "next";
import ShoppingBag from "@/components/shop/ShoppingBag";

export const metadata: Metadata = { title: "Your bag — Kinta & Co." };

export default function CartPage() {
  return <ShoppingBag />;
}
