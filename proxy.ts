import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Chequeo optimista (solo firma del JWT, sin DB). La autorización real está en src/server/auth/dal.ts.
const PUBLIC = [
  /^\/login$/,
  /^\/register$/,
  /^\/api\/health$/,
  /^\/api\/cron\//,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
];
const AUTH_PAGES = [/^\/login$/, /^\/register$/];
const COOKIE = process.env.JWT_COOKIE_NAME || "elbravo_token";

async function isLoggedIn(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const loggedIn = await isLoggedIn(req);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", pathname + search);

  // `expired=1`: la firma es válida pero la sesión fue revocada (dal.ts); hay que dejar ver /login.
  if (AUTH_PAGES.some((r) => r.test(pathname)) && loggedIn && req.nextUrl.searchParams.get("expired") !== "1") {
    return NextResponse.redirect(new URL("/home", req.url));
  }
  if (PUBLIC.some((r) => r.test(pathname)) || loggedIn) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|txt)$).*)"],
};
