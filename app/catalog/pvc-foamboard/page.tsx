import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PvcFoamboardProduct from "@/components/PvcFoamboardProduct";

export const metadata = {
  title: "PVC Foamboard — Mounting | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/mounting">Mounting</Link>
          <span>›</span>
          <span className="crumb-current">PVC Foamboard</span>
        </nav>
        <PvcFoamboardProduct />
      </main>
      <Footer />
    </>
  );
}
