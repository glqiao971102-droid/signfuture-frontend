import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AluminiumAboardStand100x200Product from "@/components/AluminiumAboardStand100x200Product";

export const metadata = {
  title: "Aluminium Aboard Stand 100cm x 200cm — Display System | Sign Studio",
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
          <span className="crumb-current">Aluminium Aboard Stand 100cm x 200cm</span>
        </nav>
        <AluminiumAboardStand100x200Product />
      </main>
      <Footer />
    </>
  );
}
