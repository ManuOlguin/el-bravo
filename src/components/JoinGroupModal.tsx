"use client";
// COMPAT (W2-2): app/home/page.tsx (W2-4) todavía importa este componente. El reemplazo es
// `JoinGroupButton` de src/features/group/JoinGroupSheet. Borrar cuando la home deje de usarlo.
import { JoinGroupButton } from "@/src/features/group/JoinGroupSheet";

export default function JoinGroupModal() {
  return <JoinGroupButton label="Unirte a grupo" />;
}
