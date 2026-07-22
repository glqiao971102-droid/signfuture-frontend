import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import GiantWindFlagProduct from "@/components/GiantWindFlagProduct";

export const metadata = {
  title: "Giant Wind Flag — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Giant Wind Flag</span>
        </nav>
        <GiantWindFlagProduct />
      </main>
      <Footer />
    </>
  );
}