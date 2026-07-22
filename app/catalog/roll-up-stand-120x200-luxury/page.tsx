import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RollUpStand120x200LuxuryProduct from "@/components/RollUpStand120x200LuxuryProduct";

export const metadata = {
  title: "Roll Up Stand 120cm x 200cm (Luxury) — Display System | Sign Studio",
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
          <span className="crumb-current">Roll Up Stand 120cm x 200cm (Luxury)</span>
        </nav>
        <RollUpStand120x200LuxuryProduct />
      </main>
      <Footer />
    </>
  );
}
