import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestHost(request: NextRequest) {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function isTrustedMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (CLI, webhooks internal to this project) may omit Origin.
    // Modern browsers send Origin/Sec-Fetch-Site for mutating fetch requests.
    return fetchSite !== "cross-site";
  }

  try {
    return new URL(origin).host.toLowerCase() === requestHost(request);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !isTrustedMutation(request)) {
    return NextResponse.json(
      { error: "Richiesta cross-site rifiutata", code: "CSRF_REJECTED" },
      { status: 403 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
