import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import HumanStandProduct from "@/components/HumanStandProduct";

export const metadata = {
  title: "Human Stand — Display System | Sign Studio",
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
          <span className="crumb-current">Human Stand</span>
        </nav>
        <HumanStandProduct />
      </main>
      <Footer />
    </>
  );
}
