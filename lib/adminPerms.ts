// Small helpers for reading an admin's per-section access level on the client.
// The real enforcement is the backend admin middleware; these only drive UX
// (hiding/disabling controls the admin isn't allowed to use).

type PermUser = {
  isSuperAdmin?: boolean;
  adminPermissions?: Record<string, "view" | "edit">;
} | null | undefined;

/** True if the admin can OPEN a section (any level — view or edit). */
export function canOpen(user: PermUser, section: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return Boolean(user.adminPermissions?.[section]);
}

/** True if the admin can OPERATE a section (create / edit / delete). */
export function canOperate(user: PermUser, section: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.adminPermissions?.[section] === "edit";
}

/** True if the admin has the section but only at view level (read-only). */
export function isViewOnly(user: PermUser, section: string): boolean {
  return canOpen(user, section) && !canOperate(user, section);
}
