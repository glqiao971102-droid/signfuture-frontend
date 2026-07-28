import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RollUpStand85x200Luxury2SideProduct from "@/components/RollUpStand85x200Luxury2SideProduct";

export const metadata = {
  title: "Roll Up Stand 85cm x 200cm (Luxury) (2 Side) — Display System | Sign Studio",
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
          <span className="crumb-current">Roll Up Stand 85cm x 200cm (Luxury) (2 Side)</span>
        </nav>
        <RollUpStand85x200Luxury2SideProduct />
      </main>
      <Footer />
    </>
  );
}
