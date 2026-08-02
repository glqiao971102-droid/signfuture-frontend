"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Row = { id: number; agent: string; targetUserId: number; targetEmail: string; targetLogin: string; ip: string | null; at: string };

function fmt(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminAgentLoginsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await api.adminAgentLogins(p);
      setRows(r.data);
      setLastPage(r.meta.lastPage);
      setTotal(r.meta.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [page, load]);

  return (
    <>
      <div className="adm-page-head">
        <h1>Agent Logins</h1>
        <p>Every proxy login — which agent logged into which customer account, and when.</p>
      </div>
      <div className="adm-wrap">
        <div className="adm-count">{loading ? "Loading…" : `${total.toLocaleString()} login${total === 1 ? "" : "s"}`}</div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>When</th><th>Agent</th><th>Logged into</th><th>IP</th></tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && <tr><td colSpan={4} className="adm-empty">No agent logins yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-date">{fmt(r.at)}</td>
                  <td className="adm-login">{r.agent}</td>
                  <td>
                    <Link href={`/admin/users/${r.targetUserId}`} className="adm-edit-link">{r.targetEmail || r.targetLogin || `#${r.targetUserId}`}</Link>
                  </td>
                  <td className="adm-email">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="adm-pager">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</button>
            <span>Page {page} of {lastPage}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}
