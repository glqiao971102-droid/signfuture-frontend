"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** /admin lands on the Users section. */
export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);
  return <div className="adm-page-head">Loading…</div>;
}
