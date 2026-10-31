import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/src/components/shell/AppShell";
import { InstallPrompt } from "@/src/components/shell/InstallPrompt";
import { RegisterServiceWorker } from "@/src/components/shell/RegisterServiceWorker";
import { Providers } from "@/src/components/ui/Providers";
import { getSession } from "@/src/server/auth/dal";
import { unreadCount } from "@/src/server/notifications/queries";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "El Bravo", template: "%s · El Bravo" },
  description: "Entrená con tus amigos, sumá puntos y competí por temporadas.",
  applicationName: "El Bravo",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "El Bravo" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
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
  const unreadNotifications = session ? await unreadCount(session.id).catch(() => 0) : 0;
  return (
    <html lang="es-AR" className={`${montserrat.variable} dark`} style={{ colorScheme: "dark" }}>
      <body className="min-h-dvh bg-bg font-sans text-fg">
        <Providers>
          <AppShell
            user={session ? { id: session.id, name: session.name, photoUrl: session.photoUrl, unreadNotifications, timezone: session.timezone } : null}
          >
            {children}
          </AppShell>
          <InstallPrompt />
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
