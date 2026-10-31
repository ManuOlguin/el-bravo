import type { Metadata } from "next";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { getUserPreferences } from "@/src/server/notifications/preferences";
import { isEmailEnabled } from "@/src/server/notifications/email";
import { PreferencesForm } from "@/src/features/notifications/PreferencesForm";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationSettingsPage() {
  const user = await requirePageUser();
  const { rows, weeklyDigest } = await getUserPreferences(user.id);
  return (
    <div className="mx-auto max-w-screen-sm space-y-4">
      <PageHeader title="Notificaciones" subtitle="Elegí qué querés que te avisemos y por dónde." back="/settings" />
      {!isEmailEnabled() && (
        <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-sm text-fg-muted">
          El envío de emails todavía no está activo. Tus preferencias de email quedan guardadas para cuando lo activemos.
        </p>
      )}
      <PreferencesForm initialRows={rows} initialWeeklyDigest={weeklyDigest} />
    </div>
  );
}
