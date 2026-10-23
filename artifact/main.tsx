// The real application components, with client-side routes for a single HTML file.
import { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { DefaultLoadingManager } from "three";
import Home from "@/app/page";
import ProductPurchase from "@/components/shop/ProductPurchase";
import ShoppingBag from "@/components/shop/ShoppingBag";
import { BRAND, getProductBySlug, getProductVariants } from "@/lib/products";
import { artifactAsset } from "./assets";
import Link from "./link-shim";

DefaultLoadingManager.setURLModifier(artifactAsset);

const currentRoute = () => window.location.hash.replace(/^#/, "") || "/";
const subscribeRoute = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
};

function ArtifactApp() {
  const route = useSyncExternalStore(subscribeRoute, currentRoute, () => "/");
  const url = new URL(route, "https://kinta.invalid");
  const productMatch = /^\/products\/([^/]+)\/?$/.exec(url.pathname);
  const design = productMatch ? getProductBySlug(productMatch[1]) : undefined;
  const variants = design ? getProductVariants(design) : [];
  const selected = variants.find((variant) => variant.id === url.searchParams.get("color")) ?? design;
  const isHome = url.pathname === "/";
  const isBag = url.pathname === "/cart" || url.pathname === "/cart/";

  useEffect(() => {
    document.title = selected ? `${selected.title} — ${BRAND.name}` : isBag ? `Your bag — ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
    window.scrollTo(0, 0);
  }, [route, selected, isBag]);

  if (isHome) return <Home />;
  if (isBag) return <ShoppingBag />;
  if (selected) return <ProductPurchase key={selected.id} initialProduct={selected} variants={variants} />;
  return (
    <main style={{ display: "grid", placeContent: "center", textAlign: "center", gap: 20, padding: 24 }}>
      <h1>That piece isn’t on the rack.</h1>
      <Link href="/">Back to the collection →</Link>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ArtifactApp />);
