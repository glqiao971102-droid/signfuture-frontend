import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AcrylicSheetProduct from "@/components/AcrylicSheetProduct";

export const metadata = {
  title: "Acrylic Sheet | Sign Studio",
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
          <span className="crumb-current">Acrylic Sheet</span>
        </nav>
        <AcrylicSheetProduct />
      </main>
      <Footer />
    </>
  );
}
