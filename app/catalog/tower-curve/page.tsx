import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TowerCurveProduct from "@/components/TowerCurveProduct";

export const metadata = {
  title: "Tower (Curve) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Tower (Curve)</span>
        </nav>
        <TowerCurveProduct />
      </main>
      <Footer />
    </>
  );
}