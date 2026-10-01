import { BRAND } from "@/lib/products";
import styles from "./SeeAvailability.module.css";

interface Props {
  /** fades with the header/marquee when the product view opens */
  home?: boolean;
  tabIndex?: number;
}

/** Outlined pill. Orders are taken over Instagram DM. */
export default function SeeAvailability({ home, tabIndex }: Props) {
  const link = (
    <a className={styles.pill} href={BRAND.instagram} target="_blank" rel="noopener noreferrer" tabIndex={tabIndex}>
      See availability
    </a>
  );
  if (!home) return link;
  return (
    <div className={styles.home} data-home-fade>
      {link}
    </div>
  );
}
