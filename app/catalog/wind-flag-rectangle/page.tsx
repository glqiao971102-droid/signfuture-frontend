import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WindFlagRectangleProduct from "@/components/WindFlagRectangleProduct";

export const metadata = {
  title: "Wind Flag (Rectangle) — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Wind Flag (Rectangle)</span>
        </nav>
        <WindFlagRectangleProduct />
      </main>
      <Footer />
    </>
  );
}
