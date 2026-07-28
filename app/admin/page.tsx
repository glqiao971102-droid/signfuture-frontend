"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/** Admin sections. Only Products has a full editor UI today. */
const SECTIONS: {
  href: string;
  title: string;
  desc: string;
  glyph: string;
  ready: boolean;
}[] = [
  {
    href: "/admin/products",
    title: "Products",
    desc: "Edit calculator options and prices — materials, printing, finishing, price grids.",
    glyph: "▤",
    ready: true,
  },
  {
    href: "/admin/vouchers",
    title: "Vouchers",
    desc: "Discount codes and member rewards. Managed via the seeder / API for now.",
    glyph: "▧",
    ready: false,
  },
];

/**
 * Admin home. Landing page linking to each management section; gated to
 * administrator accounts.
 */
export default function AdminHome() {
  const { user, loading } = useAuth();
  const isAdmin = !!user?.roles?.includes("administrator");

  if (loading) return <main className="admin-wrap"><p className="admin-muted">Loading…</p></main>;
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
          <h1>Admin</h1>
          <p className="admin-muted">Signed in as {user.name}. Choose a section to manage.</p>
        </div>
      </div>

      <div className="admin-grid">
        {SECTIONS.map((s) =>
          s.ready ? (
            <Link key={s.href} href={s.href} className="admin-card">
              <span className="admin-card-name">
                <span aria-hidden="true" style={{ marginRight: 8 }}>{s.glyph}</span>
                {s.title}
              </span>
              <span className="admin-card-meta">{s.desc}</span>
            </Link>
          ) : (
            <div key={s.href} className="admin-card" style={{ opacity: 0.55, cursor: "default" }}>
              <span className="admin-card-name">
                <span aria-hidden="true" style={{ marginRight: 8 }}>{s.glyph}</span>
                {s.title}
                <em className="admin-off"> · soon</em>
              </span>
              <span className="admin-card-meta">{s.desc}</span>
            </div>
          )
        )}
      </div>
    </main>
  );
}
