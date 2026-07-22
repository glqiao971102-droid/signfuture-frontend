import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import EaselStandProduct from "@/components/EaselStandProduct";

export const metadata = {
  title: "Easel Stand — Display System | Sign Studio",
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
          <span className="crumb-current">Easel Stand</span>
        </nav>
        <EaselStandProduct />
      </main>
      <Footer />
    </>
  );
}
