import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PopUpBackdropCurveProduct from "@/components/PopUpBackdropCurveProduct";

export const metadata = {
  title: "Pop Up Backdrop Display (Curve) — Display System | Sign Studio",
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
          <span className="crumb-current">Pop Up Backdrop Display (Curve)</span>
        </nav>
        <PopUpBackdropCurveProduct />
      </main>
      <Footer />
    </>
  );
}
