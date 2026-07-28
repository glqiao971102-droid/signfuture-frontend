import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import StraightBackdropProduct from "@/components/StraightBackdropProduct";

export const metadata = {
  title: "Straight Backdrop — Fabric Display | Sign Studio",
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
          <span className="crumb-current">Straight Backdrop</span>
        </nav>
        <StraightBackdropProduct />
      </main>
      <Footer />
    </>
  );
}
