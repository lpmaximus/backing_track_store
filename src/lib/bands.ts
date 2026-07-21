/**
 * Constantes de domínio de banda (R2 / ADR-BTS-002).
 * Módulo puro — sem imports de banco. Pode ser usado no client e nas rotas.
 */

// Teto de integrantes por banda: líder + 5 = 6 no total (decisão de 2026-07-18).
// A contagem inclui o líder, que é uma linha 'active' em band_members. Para
// afrouxar por banda no futuro, migrar para bands.maxMembers (default 6).
export const MAX_BAND_MEMBERS = 6;
