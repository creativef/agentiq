export function canAccess(
  role: "OWNER" | "CEO" | "AGENT",
  userCompanyId: string,
  resourceCompanyId: string
) {
  if (role === "OWNER") return true;
  return userCompanyId === resourceCompanyId;
}
