export function managementPage(pathname: string) {
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return (
    /^\/admin\/document(?:\/|$)/.test(pathname) ||
    /^\/admin\/m\/(invoices|receipts)\/?$/.test(pathname)
  );
}
