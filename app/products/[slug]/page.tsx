import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductVariants } from "@/lib/products";
import ProductPurchase from "@/components/shop/ProductPurchase";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  return { title: product ? `${product.title} — Kinta & Co.` : "Product not found — Kinta & Co." };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();
  const variants = getProductVariants(product);
  const color = (await searchParams).color;
  const selected = variants.find((variant) => variant.id === color) ?? product;
  return <ProductPurchase key={selected.id} initialProduct={selected} variants={variants} />;
}
