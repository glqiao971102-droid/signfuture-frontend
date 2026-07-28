import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BackpackFlagTeardropProduct from "@/components/BackpackFlagTeardropProduct";

export const metadata = {
  title: "Backpack Flag (Teardrop) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Backpack Flag (Teardrop)</span>
        </nav>
        <BackpackFlagTeardropProduct />
      </main>
      <Footer />
    </>
  );
}