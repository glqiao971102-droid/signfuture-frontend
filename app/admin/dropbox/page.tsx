"use client";

import AdminDropbox from "@/components/admin/AdminDropbox";

export default function AdminDropboxPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>SF Dropbox</h1>
        <p>
          Our own file library. When an order is set to Processing its production files (uploaded
          artwork + Job Order PDF) are copied here automatically, organised per order and job —
          production browses and downloads from here.
        </p>
      </div>
      <AdminDropbox />
    </>
  );
}
