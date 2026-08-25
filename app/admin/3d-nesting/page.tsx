"use client";

import Admin3DNesting from "@/components/admin/Admin3DNesting";

export default function Admin3DNestingPage() {
  return (
    <>
      <div className="adm-page-head">
        <h1>3D Printer File Auto Nesting</h1>
        <p>Arrange letters / logos onto 80 × 80 cm 3D-print plates, with Slow / Medium / Fast packing.</p>
      </div>
      <Admin3DNesting />
    </>
  );
}
