"use client";

import AdminVouchers from "@/components/admin/AdminVouchers";

export default function AdminVouchersPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Vouchers</h1>
        <p>Create scoped vouchers and send them to specific customers or by registration date.</p>
      </div>
      <AdminVouchers />
    </>
  );
}
