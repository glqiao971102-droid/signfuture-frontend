import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WindFlagWaterBaseProduct from "@/components/WindFlagWaterBaseProduct";

export const metadata = {
  title: "Wind Flag (Water Base) — Fabric Display | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/fabric-display">Fabric Display</Link>
          <span>›</span>
          <span className="crumb-current">Wind Flag (Water Base)</span>
        </nav>
        <WindFlagWaterBaseProduct />
      </main>
      <Footer />
    </>
  );
}