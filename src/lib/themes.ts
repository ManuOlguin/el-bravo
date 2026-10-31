/**
 * Temas de color (portados de el-bravo-prod, abril 2026). Los colores viven en `app/globals.css`
 * (`[data-theme="…"]`); acá solo el nombre, la clave guardada y cómo aplicarlo. Se recuerda por
 * dispositivo con la MISMA clave que usaba la versión anterior, así quien ya había elegido lo conserva.
 */
export type ThemeName = "manu" | "leo";

export const THEME_STORAGE_KEY = "elbravo-theme";
export const DEFAULT_THEME: ThemeName = "manu";

export const THEMES: { id: ThemeName; name: string; description: string; themeColor: string }[] = [
  { id: "manu", name: "Manu Tema", description: "Negro y grises con verde", themeColor: "rgb(10 10 10)" },
  { id: "leo", name: "Leo Tema", description: "Azul marino con verde", themeColor: "rgb(8 20 45)" },
];

export const isThemeName = (v: unknown): v is ThemeName => v === "manu" || v === "leo";

/**
 * Script inline para el <head>: aplica el tema guardado ANTES de pintar (sin parpadeo del tema por defecto).
 * Se mantiene chico y sin dependencias; lo mismo hace `applyTheme` después.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="leo"&&t!=="manu")t=${JSON.stringify(DEFAULT_THEME)};document.documentElement.setAttribute("data-theme",t);var c=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, t.themeColor])))}[t];var m=document.querySelector('meta[name="theme-color"]');if(m&&c)m.setAttribute("content",c)}catch(e){}})();`;

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const t = document.documentElement.getAttribute("data-theme");
  return isThemeName(t) ? t : DEFAULT_THEME;
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  const color = THEMES.find((t) => t.id === theme)?.themeColor;
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // sin storage: el tema dura hasta recargar
  }
}
