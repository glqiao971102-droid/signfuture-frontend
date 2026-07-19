import AccountSubPage from "@/components/AccountSubPage";
import ReloadList from "@/components/ReloadList";

export const metadata = { title: "Reload Status — Sign Studio" };

export default function Page() {
  return (
    <AccountSubPage
      title="Reload Status"
      blurb="Your wallet top-up history and payment status."
      glyph="↻"
    >
      <ReloadList />
    </AccountSubPage>
  );
}
