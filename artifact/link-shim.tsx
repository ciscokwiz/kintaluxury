// Native hash anchors preserve keyboard and modified-click behavior.
import type { AnchorHTMLAttributes } from "react";
import { artifactHref } from "./navigation-shim";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={artifactHref(href)} {...rest} />;
}
