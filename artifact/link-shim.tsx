// next/link stand-in for the standalone build (a plain anchor is all the page needs).
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href === "/" ? "#" : href} {...rest} />;
}
