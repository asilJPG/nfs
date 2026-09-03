/**
 * Логин вместо почты.
 *
 * Supabase Auth идентифицирует пользователя только email-адресом, поэтому для
 * каждого сотрудника заводится служебный адрес `<login>@stampy.local`. Он
 * существует лишь внутри Auth: письма на него не уходят, пользователю он не
 * показывается, а сам вход выглядит как «логин + пароль».
 */
const LOGIN_DOMAIN = "stampy.local";

export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Приводит то, что ввёл человек, к каноническому логину. */
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
