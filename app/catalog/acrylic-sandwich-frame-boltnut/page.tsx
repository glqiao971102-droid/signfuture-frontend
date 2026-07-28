import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AcrylicSandwichFrameProduct from "@/components/AcrylicSandwichFrameProduct";

export const metadata = {
  title: "Acrylic Sandwich Frame (with Boltnut) | Sign Studio",
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
          <span className="crumb-current">Acrylic Sandwich Frame (with Boltnut)</span>
        </nav>
        <AcrylicSandwichFrameProduct />
      </main>
      <Footer />
    </>
  );
}