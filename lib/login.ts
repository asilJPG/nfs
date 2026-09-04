// Supabase Auth умеет только email — заводим служебный <login>@stampy.local, наружу не светит
const LOGIN_DOMAIN = "stampy.local";

export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeLogin(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

export function loginToAuthEmail(login: string): string {
  return `${normalizeLogin(login)}@${LOGIN_DOMAIN}`;
}

export function isValidLogin(login: string): boolean {
  return LOGIN_PATTERN.test(normalizeLogin(login));
}

export const LOGIN_HINT =
  "Латиница, цифры, точка, дефис и подчёркивание; от 4 до 32 символов.";
