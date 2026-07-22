import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AluminiumAboardStand100x300Product from "@/components/AluminiumAboardStand100x300Product";

export const metadata = {
  title: "Aluminium Aboard Stand 100cm x 300cm — Display System | Sign Studio",
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
          <span className="crumb-current">Aluminium Aboard Stand 100cm x 300cm</span>
        </nav>
        <AluminiumAboardStand100x300Product />
      </main>
      <Footer />
    </>
  );
}
