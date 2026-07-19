"use client";

export default function DateRangeBar({
  from,
  to,
  setFrom,
  setTo,
  onReset,
  count,
  total,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onReset: () => void;
  count: number;
  total: number;
}) {
  return (
    <div className="rec-filter">
      <label className="qf-field">
        <span>Date From</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <span className="qf-to">TO</span>
      <label className="qf-field">
        <span>Date To</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button type="button" className="qf-reset" onClick={onReset}>
        Reset
      </button>
      <span className="rec-filter-count">
        Showing {count} of {total}
      </span>
    </div>
  );
}
