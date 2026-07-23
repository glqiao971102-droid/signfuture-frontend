"use client";

import AdminTiers from "@/components/admin/AdminTiers";

export default function AdminTiersPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Membership</h1>
        <p>Tier distribution and per-member tier changes.</p>
      </div>
      <AdminTiers />
    </>
  );
}
