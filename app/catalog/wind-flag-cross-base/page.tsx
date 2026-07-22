import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WindFlagCrossBaseProduct from "@/components/WindFlagCrossBaseProduct";

export const metadata = {
  title: "Wind Flag (Cross Base) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Wind Flag (Cross Base)</span>
        </nav>
        <WindFlagCrossBaseProduct />
      </main>
      <Footer />
    </>
  );
}