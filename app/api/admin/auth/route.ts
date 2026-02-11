import { NextRequest } from "next/server";
import { adminCookieOptions, getAdminSecret } from "@/lib/admin-auth";

/**
 * POST: validate password and set admin_token cookie if correct.
 * Body: { password: string }
 */
export async function POST(request: NextRequest) {
  const secret = getAdminSecret();
  if (!secret) {
    return Response.json(
      { error: "Admin not configured" },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  if (password !== secret) {
    return Response.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  const opts = adminCookieOptions();
  const cookieHeader =
    `${opts.name}=${encodeURIComponent(opts.value)}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=Lax` +
    (opts.secure ? "; Secure" : "");

  return Response.json({ ok: true }, {
    headers: {
      "Set-Cookie": cookieHeader,
    },
  });
}
