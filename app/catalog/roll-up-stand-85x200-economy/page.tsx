import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RollUpStand85x200EconomyProduct from "@/components/RollUpStand85x200EconomyProduct";

export const metadata = {
  title: "Roll Up Stand 85cm x 200cm (Economy) — Display System | Sign Studio",
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
          <span className="crumb-current">Roll Up Stand 85cm x 200cm (Economy)</span>
        </nav>
        <RollUpStand85x200EconomyProduct />
      </main>
      <Footer />
    </>
  );
}
