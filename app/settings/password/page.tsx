import type { Metadata } from "next";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { ChangePasswordForm } from "@/src/features/account/ChangePasswordForm";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function SettingsPasswordPage() {
  await requirePageUser();
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Contraseña" back="/settings" />
      <ChangePasswordForm />
    </div>
  );
}
