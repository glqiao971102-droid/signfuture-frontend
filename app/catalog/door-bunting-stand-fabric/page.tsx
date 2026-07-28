import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DoorBuntingStandFabricProduct from "@/components/DoorBuntingStandFabricProduct";

export const metadata = {
  title: "Door Bunting Stand (Fabric Display) — Fabric Display | Sign Studio",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <nav className="crumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category/fabric-display">Fabric Display</Link>
          <span>›</span>
          <span className="crumb-current">Door Bunting Stand (Fabric Display)</span>
        </nav>
        <DoorBuntingStandFabricProduct />
      </main>
      <Footer />
    </>
  );
}
