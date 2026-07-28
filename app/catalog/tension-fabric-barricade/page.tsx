import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TensionFabricBarricadeProduct from "@/components/TensionFabricBarricadeProduct";

export const metadata = {
  title: "Tension Fabric Barricade — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Tension Fabric Barricade</span>
        </nav>
        <TensionFabricBarricadeProduct />
      </main>
      <Footer />
    </>
  );
}
