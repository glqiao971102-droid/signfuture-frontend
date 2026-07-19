import AccountSubPage from "@/components/AccountSubPage";
import InvoiceList from "@/components/InvoiceList";

export const metadata = { title: "Download Invoice — Sign Studio" };

export default function Page() {
  return (
    <AccountSubPage
      title="Download Invoice"
      blurb="Download a PDF invoice for any of your orders."
      glyph="⤓"
    >
      <InvoiceList />
    </AccountSubPage>
  );
}
