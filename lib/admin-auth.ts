import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "admin_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getAdminSecret(): string | undefined {
  return process.env.ADMIN_SECRET;
}

/**
 * Returns true if the request has a valid admin cookie.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return token === secret;
}

/**
 * Cookie options for setting the admin token (use in API route).
 */
export function adminCookieOptions(): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: string;
} {
  return {
    name: ADMIN_COOKIE_NAME,
    value: getAdminSecret() ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  };
}

export { ADMIN_COOKIE_NAME };
