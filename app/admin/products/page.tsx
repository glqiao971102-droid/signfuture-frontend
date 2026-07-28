"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, resolveImageUrl, type AdminProductRow } from "@/lib/api";

export default function AdminProductsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);

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

  // Group products by category, preserving a stable category order.
  const grouped = useMemo(() => {
    const map = new Map<string, AdminProductRow[]>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const categories = useMemo(() => grouped.map(([c]) => c), [grouped]);
  const visible = filter ? grouped.filter(([c]) => c === filter) : grouped;

  return (
    <>
      <div className="adm-page-head adm-products-head">
        <div>
          <h1>Products</h1>
          <p>Grouped by category. Configure inputs, option prices and the pricing formula.</p>
        </div>
        <button type="button" className="hero-btn primary" onClick={() => setShowNew(true)}>
          + New product
        </button>
      </div>

      {showNew && (
        <NewProductForm
          categories={categories}
          onClose={() => setShowNew(false)}
          onCreated={(slug) => router.push(`/admin/products/${slug}`)}
        />
      )}

      <div className="adm-cat-filter">
        <button
          type="button"
          className={`adm-filter${filter === "" ? " is-active" : ""}`}
          onClick={() => setFilter("")}
        >
          All ({rows.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`adm-filter${filter === c ? " is-active" : ""}`}
            onClick={() => setFilter(c)}
          >
            {c} ({grouped.find(([g]) => g === c)?.[1].length})
          </button>
        ))}
      </div>

      {error && <div className="quote-empty">{error}</div>}
      {loading && <div className="adm-empty">Loading products…</div>}

      {!loading &&
        !error &&
        visible.map(([category, items]) => (
          <section key={category} className="adm-cat-section">
            <h2 className="adm-cat-title">
              {category} <span>{items.length}</span>
            </h2>
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="adm-num">Inputs</th>
                    <th className="adm-num">Options</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.slug}>
                      <td className="adm-login">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="adm-thumb" src={resolveImageUrl(p.imageUrl) ?? ""} alt="" />
                        ) : (
                          <span className="adm-thumb-empty" />
                        )}
                        {p.name}
                      </td>
                      <td className="adm-num adm-mono">{p.inputCount}</td>
                      <td className="adm-num adm-mono">{p.optionCount}</td>
                      <td>
                        <span
                          className={`adm-chip ${p.active ? "tier-diamond" : "adm-chip-member"}`}
                        >
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
          </section>
        ))}
    </>
  );
}

/** Create a product: pick a category (or type a new one) and a name. */
function NewProductForm({
  categories,
  onClose,
  onCreated,
}: {
  categories: string[];
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Inkjet Printing");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    const cat = (category === "__new" ? newCategory : category).trim();
    if (!name.trim() || !cat) {
      setError("Name and category are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.adminCreateProduct(name.trim(), cat);
      onCreated(res.slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create product");
      setCreating(false);
    }
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={create}>
        <h2>New product</h2>
        <label className="adm-modal-field">
          Product name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Vinyl Sticker" />
        </label>
        <label className="adm-modal-field">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new">+ New category…</option>
          </select>
        </label>
        {category === "__new" && (
          <label className="adm-modal-field">
            New category name
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Signage" />
          </label>
        )}
        {error && <p className="adm-save-err">{error}</p>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-image-remove" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="hero-btn primary" disabled={creating}>
            {creating ? "Creating…" : "Create & edit"}
          </button>
        </div>
      </form>
    </div>
  );
}
