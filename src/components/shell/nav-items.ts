export type NavIconName = "home" | "users" | "plus" | "chart" | "user";

export type NavItem = {
  id: "home" | "groups" | "log" | "stats" | "profile";
  label: string;
  href: string;
  icon: NavIconName;
  enabled: boolean;
  primary?: boolean;
};

// Cada workstream habilita su ítem cuando su página existe (ver 00-roadmap §6.3).
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Inicio", href: "/home", icon: "home", enabled: true },
  { id: "groups", label: "Grupos", href: "/groups", icon: "users", enabled: false },
  { id: "log", label: "Registrar", href: "/load", icon: "plus", enabled: true, primary: true }, // W2-1 lo cambia a /workout/new
  { id: "stats", label: "Stats", href: "/stats", icon: "chart", enabled: true },
  { id: "profile", label: "Perfil", href: "/profile", icon: "user", enabled: true },
];

/** Rutas donde no se muestra el shell (pantallas de auth). */
export const SHELL_HIDDEN_PATHS = ["/login", "/register"];

export function isNavItemActive(item: Pick<NavItem, "href">, pathname: string | null) {
  if (!pathname) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
