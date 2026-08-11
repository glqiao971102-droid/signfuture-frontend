/**
 * True only during local `next dev` (NODE_ENV === "development").
 *
 * Gates demo-only conveniences — the auto-logged-in preview user and the sample
 * voucher / invoice / reload data — so they NEVER appear on the production
 * build. Vercel builds with NODE_ENV === "production", so `DEV_PREVIEW` is
 * false there: live uses the real login flow and real data.
 */
export const DEV_PREVIEW = process.env.NODE_ENV === "development";
