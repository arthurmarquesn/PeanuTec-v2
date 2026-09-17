import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "peanutec_session";
const PUBLIC_PAGE_PATHS = new Set(["/login", "/cadastro"]);
const PUBLIC_API_PREFIX = "/api/auth/";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Public assets should never depend on authentication.
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    (!pathname.startsWith("/api/") && pathname.includes("."))
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!hasSessionCookie) {
      return NextResponse.json(
        { detail: "Autenticação necessária." },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    if (hasSessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
