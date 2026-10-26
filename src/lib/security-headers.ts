export function secureResponse(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (!headers.has("Referrer-Policy"))
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  );
  const url = new URL(request.url);
  if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000");
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/quote/accept")
  ) {
    headers.set("Cache-Control", "no-store, private");
    headers.set("Referrer-Policy", "no-referrer");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
