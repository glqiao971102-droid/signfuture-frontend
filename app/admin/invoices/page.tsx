"use client";

import AdminInvoices from "@/components/admin/AdminInvoices";

export default function AdminInvoicesPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Invoices</h1>
        <p>Every invoiced order, searchable and exportable.</p>
      </div>
      <AdminInvoices />
    </>
  );
}
