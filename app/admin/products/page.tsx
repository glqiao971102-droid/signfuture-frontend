"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { api, type AdminProductRow } from "@/lib/api";

/**
 * Admin · product list. Grouped by category; each row links to the editor
 * where the calculator options and prices are configured.
 */
export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles?.includes("administrator");

  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.adminProducts();
        if (!cancelled) setRows(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) => r.name.toLowerCase().includes(needle) || r.slug.includes(needle)
        )
      : rows;
    const map = new Map<string, AdminProductRow[]>();
    for (const r of filtered) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return [...map.entries()];
  }, [rows, q]);

  if (authLoading) return <main className="admin-wrap"><p className="admin-muted">Loading…</p></main>;
  if (!user) {
    return (
      <main className="admin-wrap">
        <h1>Admin</h1>
        <p className="admin-muted">Please sign in with an administrator account.</p>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main className="admin-wrap">
        <h1>Admin</h1>
        <p className="admin-muted">Your account doesn&apos;t have administrator access.</p>
      </main>
    );
  }

  return (
    <main className="admin-wrap">
      <div className="admin-head">
        <div>
          <h1>Products</h1>
          <p className="admin-muted">{rows.length} calculator products · edit options &amp; prices.</p>
        </div>
        <input
          className="admin-search"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading && <p className="admin-muted">Loading products…</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading &&
        grouped.map(([category, items]) => (
          <section key={category} className="admin-cat">
            <h2>{category}</h2>
            <div className="admin-grid">
              {items.map((p) => (
                <Link key={p.slug} href={`/admin/products/${p.slug}`} className="admin-card">
                  <span className="admin-card-name">{p.name}</span>
                  <span className="admin-card-meta">
                    {p.optionCount} option{p.optionCount === 1 ? "" : "s"} ·{" "}
                    {p.inputCount} input{p.inputCount === 1 ? "" : "s"}
                    {!p.active && <em className="admin-off"> · hidden</em>}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}
