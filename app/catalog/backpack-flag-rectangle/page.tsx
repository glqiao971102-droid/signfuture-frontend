import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BackpackFlagRectangleProduct from "@/components/BackpackFlagRectangleProduct";

export const metadata = {
  title: "Backpack Flag (Rectangle) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Backpack Flag (Rectangle)</span>
        </nav>
        <BackpackFlagRectangleProduct />
      </main>
      <Footer />
    </>
  );
}