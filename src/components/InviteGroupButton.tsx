"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  setPopupInviteOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function InviteGroupButton({ setPopupInviteOpen }: Props) {
  const router = useRouter();

  async function onInvite() {
    setPopupInviteOpen(true);

  }

  return (
    <button
      type="button"
      onClick={onInvite}
      className="inline-flex items-center px-3 py-2 bg-surface rounded-md text-sm font-bold hover:bg-surfacehover"
      title="Solo admins"
    >
      Invitar
    </button>
  );
}
