import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import WindFlagProduct from "@/components/WindFlagProduct";

export const metadata = {
  title: "Wind Flag 3.4m (Cross Base) — Display System | Sign Studio",
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
          <span className="crumb-current">Wind Flag 3.4m (Cross Base)</span>
        </nav>
        <WindFlagProduct />
      </main>
      <Footer />
    </>
  );
}
