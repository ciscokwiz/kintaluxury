import type { ImgHTMLAttributes } from "react";
import { artifactAsset } from "./assets";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  fill?: boolean;
};

export default function Image({ src, alt = "", priority, fill, style, ...props }: Props) {
  // All images are embedded data URLs; a Next image server is unnecessary.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} src={typeof src === "string" ? artifactAsset(src) : src} loading={priority ? "eager" : props.loading} decoding="async" style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
}
