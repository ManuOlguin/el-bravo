// Tipos y constantes de reacciones (sin "server-only": los usa ReactionBar en el cliente).

export const REACTION_EMOJIS = ["💪", "🔥", "👏", "😂", "🫡"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export type ReactionSummary = { emoji: ReactionEmoji; count: number; mine: boolean; users: { id: string; name: string | null }[] }[];

/**
 * La columna `Reaction.emoji` guarda una CLAVE ASCII, no el emoji literal: con la collation
 * `utf8mb4_unicode_ci` de MySQL todos los emojis fuera del BMP se comparan como iguales
 * ('💪' = '🔥'), lo que rompería el unique (activityId, userId, emoji) y los filtros por emoji.
 * Leé/escribí siempre con `emojiKey()` / `emojiFromKey()`.
 */
export const EMOJI_KEYS: Record<ReactionEmoji, string> = {
  "💪": "muscle",
  "🔥": "fire",
  "👏": "clap",
  "😂": "joy",
  "🫡": "salute",
};

const BY_KEY = new Map(Object.entries(EMOJI_KEYS).map(([emoji, key]) => [key, emoji as ReactionEmoji]));

export function emojiKey(emoji: ReactionEmoji): string {
  return EMOJI_KEYS[emoji];
}

export function emojiFromKey(key: string): ReactionEmoji | null {
  return BY_KEY.get(key) ?? null;
}

export function isReactionEmoji(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJIS as readonly string[]).includes(v);
}

/** Aplica un toggle a un resumen (para la UI optimista). */
export function toggleInSummary(summary: ReactionSummary, emoji: ReactionEmoji, me: { id: string; name: string | null }): ReactionSummary {
  const map = new Map(summary.map((s) => [s.emoji, { ...s, users: [...s.users] }]));
  const cur = map.get(emoji);
  if (cur?.mine) {
    cur.count -= 1;
    cur.mine = false;
    cur.users = cur.users.filter((u) => u.id !== me.id);
    if (cur.count <= 0) map.delete(emoji);
  } else if (cur) {
    cur.count += 1;
    cur.mine = true;
    cur.users.push(me);
  } else {
    map.set(emoji, { emoji, count: 1, mine: true, users: [me] });
  }
  return REACTION_EMOJIS.filter((e) => map.has(e)).map((e) => map.get(e)!);
}
