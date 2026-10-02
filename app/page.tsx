import Header from "@/components/Header";
import HoverLabel from "@/components/HoverLabel";
import Marquee from "@/components/Marquee";
import ProductView from "@/components/ProductView";
import SeeAvailability from "@/components/SeeAvailability";
import RackScene from "@/components/three/RackScene";
import TunePanel from "@/components/TunePanel";

export default function Home() {
  return (
    <main>
      <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Kinta &amp; Co. — The New African Icon</h1>
      {/* header first in the DOM so Tab order is nav → garments → pill */}
      <Header />
      <RackScene />
      <HoverLabel />
      <SeeAvailability home />
      <Marquee />
      <ProductView />
      <TunePanel />
    </main>
  );
}
