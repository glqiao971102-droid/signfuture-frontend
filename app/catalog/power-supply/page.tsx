import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PowerSupplyProduct from "@/components/PowerSupplyProduct";

export const metadata = {
  title: "Power Supply — Materials | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/materials">Materials</Link>
          <span>›</span>
          <span className="crumb-current">Power Supply</span>
        </nav>
        <PowerSupplyProduct />
      </main>
      <Footer />
    </>
  );
}
