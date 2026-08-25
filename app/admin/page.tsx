"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { canOpen } from "@/lib/adminPerms";

/**
 * /admin lands on the Dashboard when the account may see it, otherwise on the
 * first section it can (Orders → Customers). Keeps plain admins off the blocked
 * dashboard.
 */
export default function AdminIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const can = (s: string) => canOpen(user, s);
    const dest = can("dashboard")
      ? "/admin/dashboard"
      : can("orders")
        ? "/admin/orders"
        : can("customers")
          ? "/admin/users"
          : "/admin/orders";
    router.replace(dest);
  }, [router, user, loading]);

  return <div className="adm-page-head">Loading…</div>;
}
