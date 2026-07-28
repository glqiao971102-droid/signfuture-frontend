import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import HStandStraightProduct from "@/components/HStandStraightProduct";

export const metadata = {
  title: "H Stand (Straight) — Display System | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/display-system">Display System</Link>
          <span>›</span>
          <span className="crumb-current">H Stand (Straight)</span>
        </nav>
        <HStandStraightProduct />
      </main>
      <Footer />
    </>
  );
}
