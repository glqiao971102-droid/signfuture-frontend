import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BackpackFlagBowProduct from "@/components/BackpackFlagBowProduct";

export const metadata = {
  title: "Backpack Flag (Bow) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Backpack Flag (Bow)</span>
        </nav>
        <BackpackFlagBowProduct />
      </main>
      <Footer />
    </>
  );
}