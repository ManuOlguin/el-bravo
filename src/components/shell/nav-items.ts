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
  { id: "groups", label: "Grupos", href: "/groups", icon: "users", enabled: true },
  { id: "log", label: "Registrar", href: "/workout/new", icon: "plus", enabled: true, primary: true },
  { id: "stats", label: "Stats", href: "/stats", icon: "chart", enabled: true },
  { id: "profile", label: "Perfil", href: "/profile", icon: "user", enabled: true },
];

/** Rutas donde no se muestra el shell (pantallas de auth). */
export const SHELL_HIDDEN_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function isNavItemActive(item: Pick<NavItem, "href">, pathname: string | null) {
  if (!pathname) return false;
  // `/group/[id]` vive bajo la pestaña Grupos aunque su ruta no empiece con `/groups`.
  if (item.href === "/groups" && pathname.startsWith("/group/")) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
