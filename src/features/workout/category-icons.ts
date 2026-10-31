// Sin "use client": lo usan también los Server Components (detalle del entrenamiento).

/** Ícono (emoji) por `ActivityCategory.slug`; las categorías nuevas caen en el genérico. */
const ICONS: Record<string, string> = {
  strength: "🏋️",
  running: "🏃",
  trail_running: "⛰️",
  cycling: "🚴",
  indoor_cycling: "🚲",
  swimming: "🏊",
  walking_trekking: "🥾",
  yoga_pilates: "🧘",
  hiit_functional: "⚡",
  rowing: "🚣",
  climbing: "🧗",
  martial_arts: "🥋",
  dance: "💃",
  elliptical: "🌀",
  ski_snowboard: "🏂",
  water_sports: "🏄",
  calisthenics: "🤸",
  crossfit: "🔥",
  skating: "⛸️",
};

export function categoryIcon(slug: string | null | undefined): string {
  return (slug && ICONS[slug]) || "🏅";
}
