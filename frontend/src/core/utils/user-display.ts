export function getUserInitials(params: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const firstName = params.firstName?.trim();
  const lastName = params.lastName?.trim();

  if (firstName || lastName) {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
    return initials || "U";
  }

  const name = params.name?.trim();
  if (!name) return "U";

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase() || "U";
}

