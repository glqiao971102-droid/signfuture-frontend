import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PpSheetProduct from "@/components/PpSheetProduct";

export const metadata = {
  title: "PP Sheet — Mounting | Sign Studio",
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
          <span className="crumb-current">PP Sheet</span>
        </nav>
        <PpSheetProduct />
      </main>
      <Footer />
    </>
  );
}
