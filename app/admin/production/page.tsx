"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AdminProduction from "@/components/admin/AdminProduction";
import AdminProductionDetail from "@/components/admin/AdminProductionDetail";

function ProductionView() {
  const view = useSearchParams().get("view");
  return view === "detail" ? <AdminProductionDetail /> : <AdminProduction />;
}

export default function AdminProductionPage() {
  return (
    <Suspense fallback={null}>
      <ProductionView />
    </Suspense>
  );
}
