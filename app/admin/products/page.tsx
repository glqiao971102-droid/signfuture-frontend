"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type AdminProductRow } from "@/lib/api";

export default function AdminProductsPage() {
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminProducts();
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="adm-page-head">
        <h1>Products</h1>
        <p>Configure inputs, option prices and the pricing formula — no code changes.</p>
      </div>

      {error && <div className="quote-empty">{error}</div>}
      {loading && <div className="adm-empty">Loading products…</div>}

      {!loading && !error && (
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="adm-num">Inputs</th>
                <th className="adm-num">Options</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    No products yet.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.slug}>
                  <td className="adm-login">{p.name}</td>
                  <td className="adm-email">{p.category}</td>
                  <td className="adm-num adm-mono">{p.inputCount}</td>
                  <td className="adm-num adm-mono">{p.optionCount}</td>
                  <td>
                    <span className={`adm-chip ${p.active ? "tier-diamond" : "adm-chip-member"}`}>
                      {p.active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="adm-num">
                    <Link href={`/admin/products/${p.slug}`} className="adm-edit-link">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
