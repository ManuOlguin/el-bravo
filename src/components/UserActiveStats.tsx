"use client";

import { useRouter } from "next/navigation";

type Props = {};

export default function UserActiveStats({}: Props) {
  const router = useRouter();

  return (
<div className="mt-[10px] w-full grid grid-cols-2 gap-[10px] sm:flex sm:gap-3">
  {/* Card 1 */}
  <div className="bg-surface p-4 rounded-lg sm:w-1/3">
    <div className="text-5xl text-gray-300 text-center">11</div>
    <div className="text-md font-black text-white/43 text-center">
      semanas activas
    </div>
  </div>

  {/* Card 2 */}
  <div className="bg-[linear-gradient(to_bottom,#8DCD19,#616C0B)] p-4 rounded-lg sm:w-1/3">
    <div className="text-5xl text-gray-300 text-center">3</div>
    <div className="text-md font-semibold text-white/43 text-center">
      semanas perfectas
    </div>
  </div>

  {/* Card 3 */}
  <div className="bg-surface p-4 rounded-lg col-span-2 sm:w-1/3 min-w-[270px]">
    <div className="flex justify-center gap-4 mb-1">
      <div className="rounded-full h-11 w-11 border-6 border-[rgba(92,92,92,0.14)]"></div>
      <div className="rounded-full h-11 w-11 border-6 border-[rgba(92,92,92,0.14)]"></div>
      <div className="rounded-full h-11 w-11 border-6 border-[rgba(92,92,92,0.14)]"></div>
    </div>
    <div className="font-semibold text-white/43 text-center">
      entrenamientos esta semana
    </div>
  </div>
</div>

  );
}
