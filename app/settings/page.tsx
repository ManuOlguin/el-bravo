import type { Metadata } from "next";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { SettingsMenu } from "@/src/features/account/SettingsMenu";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Ajustes" subtitle={user.email} back="/profile" />
      <SettingsMenu />
    </div>
  );
}
