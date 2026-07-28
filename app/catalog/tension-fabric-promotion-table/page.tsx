import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TensionFabricPromotionTableProduct from "@/components/TensionFabricPromotionTableProduct";

export const metadata = {
  title: "Tension Fabric Promotion Table — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Tension Fabric Promotion Table</span>
        </nav>
        <TensionFabricPromotionTableProduct />
      </main>
      <Footer />
    </>
  );
}
