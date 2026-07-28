import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import JumboBannerProduct from "@/components/JumboBannerProduct";

export const metadata = {
  title: "Jumbo Banner — Display System | Sign Studio",
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
          <span className="crumb-current">Jumbo Banner</span>
        </nav>
        <JumboBannerProduct />
      </main>
      <Footer />
    </>
  );
}
