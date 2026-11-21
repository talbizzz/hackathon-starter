// Only known in-app destinations may be used after authentication.
export function authReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  const url = new URL(value, "https://local.invalid");
  if (url.origin !== "https://local.invalid" || !["/dashboard", "/plans/kreuzberg-sunday", "/"].includes(url.pathname)) return "/dashboard";
  return url.pathname + url.search;
}
