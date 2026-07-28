"use client";

import AdminCoupons from "@/components/admin/AdminCoupons";

export default function AdminCouponsPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Coupons</h1>
        <p>Discount codes carried over from the store, with their usage.</p>
      </div>
      <AdminCoupons />
    </>
  );
}
