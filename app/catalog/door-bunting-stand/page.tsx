import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DoorBuntingStandProduct from "@/components/DoorBuntingStandProduct";

export const metadata = {
  title: "Door Bunting Stand — Display System | Sign Studio",
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
          <span className="crumb-current">Door Bunting Stand</span>
        </nav>
        <DoorBuntingStandProduct />
      </main>
      <Footer />
    </>
  );
}
