export const PARTNER_COOKIE = "hazina_partner";
export const PARTNER_COOKIE_VALUE = "authenticated";

export function partnerPortalConfigured(): boolean {
  return Boolean(
    process.env.PARTNER_PORTAL_EMAIL?.trim() && process.env.PARTNER_PORTAL_PASSWORD?.trim(),
  );
}

export function partnerCredentialsValid(email: string, password: string): boolean {
  const expectedEmail = (process.env.PARTNER_PORTAL_EMAIL || "").trim().toLowerCase();
  const expectedPassword = process.env.PARTNER_PORTAL_PASSWORD || "";
  return (
    expectedEmail.length > 0 &&
    expectedPassword.length > 0 &&
    email.trim().toLowerCase() === expectedEmail &&
    password === expectedPassword
  );
}
