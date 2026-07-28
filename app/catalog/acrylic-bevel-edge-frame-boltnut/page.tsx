import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AcrylicBevelEdgeFrameProduct from "@/components/AcrylicBevelEdgeFrameProduct";

export const metadata = {
  title: "Acrylic Bevel Edge Frame (with Boltnut) | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/acrylic-sheet">Acrylic Sheet</Link>
          <span>›</span>
          <span className="crumb-current">Acrylic Bevel Edge Frame (with Boltnut)</span>
        </nav>
        <AcrylicBevelEdgeFrameProduct />
      </main>
      <Footer />
    </>
  );
}