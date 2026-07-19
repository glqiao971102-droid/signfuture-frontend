import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PaperFoamboardProduct from "@/components/PaperFoamboardProduct";

export const metadata = {
  title: "Paper Foamboard — Materials | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/materials">Materials</Link>
          <span>›</span>
          <span className="crumb-current">Paper Foamboard</span>
        </nav>
        <PaperFoamboardProduct />
      </main>
      <Footer />
    </>
  );
}
