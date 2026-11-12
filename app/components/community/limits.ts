/**
 * Limites do formulário do mural que o cliente precisa conhecer. Espelha
 * WALL_LIMITS de src/lib/community.ts (que importa banco e não pode ir para o
 * bundle do navegador). Se mudar lá, mude aqui.
 */
export const WALL_LIMITS_CLIENT = {
  name: 40,
  city: 60,
  contentMin: 3,
  contentMax: 280,
} as const;
