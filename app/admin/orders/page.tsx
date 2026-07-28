"use client";

import AdminOrders from "@/components/admin/AdminOrders";

export default function AdminOrdersPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Orders</h1>
        <p>Every order across the platform. Click an order to view details and change its status.</p>
      </div>
      <AdminOrders />
    </>
  );
}
