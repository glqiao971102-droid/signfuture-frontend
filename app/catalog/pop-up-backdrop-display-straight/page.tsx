import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PopUpBackdropStraightProduct from "@/components/PopUpBackdropStraightProduct";

export const metadata = {
  title: "Pop Up Backdrop Display (Straight) — Display System | Sign Studio",
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
          <span className="crumb-current">Pop Up Backdrop Display (Straight)</span>
        </nav>
        <PopUpBackdropStraightProduct />
      </main>
      <Footer />
    </>
  );
}
