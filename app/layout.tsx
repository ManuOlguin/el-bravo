import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import AppNavbarShell from "@/src/components/AppNavbarShell";
import { getSession } from "@/src/server/auth/dal";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "El Bravo", template: "%s · El Bravo" },
  description: "Entrená con tus amigos, sumá puntos y competí por temporadas.",
};

export const viewport: Viewport = {
  themeColor: "#08142d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="es-AR" className={`${montserrat.variable} dark`} style={{ colorScheme: "dark" }}>
      <body className="min-h-dvh bg-bg font-sans text-fg">
        {session ? (
          <AppNavbarShell userName={session.name ?? session.email} photoUrl={session.photoUrl} />
        ) : null}
        {children}
      </body>
    </html>
  );
}
