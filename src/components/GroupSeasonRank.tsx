"use client";

import { useRouter } from "next/navigation";

type Props = {};

export default function GroupSeasonRank({}: Props) {
  const router = useRouter();

  return (
<div className="w-full h-28 bg-surface rounded-lg flex items-center justify-center text-gray-400 mt-[10px]">
  Rango a implementar
</div>

  );
}
