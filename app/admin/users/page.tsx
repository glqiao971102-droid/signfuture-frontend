"use client";

import AdminUsers from "@/components/admin/AdminUsers";

export default function AdminUsersPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>Users</h1>
        <p>Every member on the platform.</p>
      </div>
      <AdminUsers />
    </>
  );
}
