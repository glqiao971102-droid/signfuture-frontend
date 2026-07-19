import AccountSubPage from "@/components/AccountSubPage";
import OrderStatusList from "@/components/OrderStatusList";

export const metadata = { title: "Order Status — Sign Studio" };

export default function Page() {
  return (
    <AccountSubPage
      title="Order Status"
      blurb="Track every confirmed order from print to collection or delivery."
      glyph="⛟"
    >
      <OrderStatusList />
    </AccountSubPage>
  );
}
