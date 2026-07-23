"use client";

import AdminWallet from "@/components/admin/AdminWallet";

export default function AdminWalletPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Wallet</h1>
        <p>Audit the store-credit ledger and make manual adjustments.</p>
      </div>
      <AdminWallet />
    </>
  );
}
