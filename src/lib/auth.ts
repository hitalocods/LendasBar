import { cookies } from "next/headers";

export const ACCESS_COOKIE = "lendas_access";
const ACCESS_VALUE = "staff";

export async function hasStaffAccess() {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value === ACCESS_VALUE;
}

export function getStaffAccessValue() {
  return ACCESS_VALUE;
}
