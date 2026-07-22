import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SShapeDisplayProduct from "@/components/SShapeDisplayProduct";

export const metadata = {
  title: "S Shape Display — Fabric Display | Sign Studio",
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
          <span className="crumb-current">S Shape Display</span>
        </nav>
        <SShapeDisplayProduct />
      </main>
      <Footer />
    </>
  );
}