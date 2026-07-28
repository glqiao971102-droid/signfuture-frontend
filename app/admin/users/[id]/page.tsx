"use client";

import { use } from "react";
import AdminCustomerDetail from "@/components/admin/AdminCustomerDetail";

export default function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <div className="adm-page-head">
        <h1>Customer</h1>
        <p>Full profile, orders and wallet history.</p>
      </div>
      <AdminCustomerDetail id={Number(id)} />
    </>
  );
}
