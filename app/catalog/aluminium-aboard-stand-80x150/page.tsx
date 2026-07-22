import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AluminiumAboardStand80x150Product from "@/components/AluminiumAboardStand80x150Product";

export const metadata = {
  title: "Aluminium Aboard Stand 80cm x 150cm — Display System | Sign Studio",
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
          <span className="crumb-current">Aluminium Aboard Stand 80cm x 150cm</span>
        </nav>
        <AluminiumAboardStand80x150Product />
      </main>
      <Footer />
    </>
  );
}
