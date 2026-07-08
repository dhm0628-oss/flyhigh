import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const APP_HOST = "app.flyhigh.tv";
const LEGACY_HOSTS = new Set(["flyhigh.tv", "www.flyhigh.tv"]);

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (!LEGACY_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname !== "/account/reset-password") {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = "https";
  redirectUrl.hostname = APP_HOST;

  return NextResponse.redirect(redirectUrl, 307);
}

export const config = {
  matcher: ["/account/reset-password"]
};
