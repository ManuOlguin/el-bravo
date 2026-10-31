import type { Metadata } from "next";
import { Card, PageHeader } from "@/src/components/ui";
import { DEFAULT_TZ } from "@/src/lib/time";
import { requirePageUser } from "@/src/server/auth/dal";
import { otherTimezones } from "@/src/features/account/timezones";
import { GroupForm } from "@/src/features/group/GroupForm";

export const metadata: Metadata = { title: "Crear grupo" };

export default async function NewGroupPage() {
  const user = await requirePageUser();
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Crear grupo" subtitle="Después invitás a tus amigos y armás la primera temporada." back="/groups" />
      <Card>
        <GroupForm
          initial={{ name: "", description: null, timezone: user.timezone || DEFAULT_TZ, photoUrl: null }}
          otherTimezones={otherTimezones()}
        />
      </Card>
    </div>
  );
}
