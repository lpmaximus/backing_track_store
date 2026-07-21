"use client";

// Guarda a senha de admin na sessão do navegador para não redigitar a cada
// módulo (R3). Segredo compartilhado — mesmo esquema do /admin de músicas.
const KEY = "bts_admin_pw";

export function getAdminPassword(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(KEY) ?? "";
}

export function setAdminPassword(pw: string): void {
  sessionStorage.setItem(KEY, pw);
}

export function clearAdminPassword(): void {
  sessionStorage.removeItem(KEY);
}

export function adminHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", "x-admin-password": getAdminPassword() };
}
