"use client";

import { useRouter } from "next/navigation";

type Props = {
  member: any; // Idealmente tipar mejor, pero dejo any para no romper nada
  weeklyRequired: number;
};

export default function GroupSeasonMembersCard({ member, weeklyRequired }: Props) {
  const router = useRouter();

  // 🔹 Datos para las bolitas
  const currentWeekCount: number = member.currentWeekCount ?? 0;

  const baseCircles = Math.max(weeklyRequired, 0);
  const hasExtra = currentWeekCount > weeklyRequired;

  return (
    <div className="bg-surface2 px-3 py-2 rounded-lg flex justify-between">
      <div className="flex">
        <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden mr-3">
          {member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photoUrl}
              alt={member.name}
              className="w-12 h-12 object-cover"
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center text-gray-300 text-2xl">
              {member.name.charAt(0)}
            </div>
          )}
        </div>

        <div>
          <div className="text-lg font-black text-white/43 text-center">
            {member.name}
          </div>

          {/* 🔹 Bolitas semanales (versión 16px) */}
          <div className="flex gap-0.5 mt-1">
            {/* Circulitos base según weeklyRequired */}
            {Array.from({ length: baseCircles }).map((_, idx) => {
              const filled = idx < currentWeekCount;
              return (
                <div
                  key={idx}
                  className={
                    "rounded-full h-[16px] w-[16px] border-[3px] transition-colors " +
                    (filled
                      ? "border-[#465902] bg-gradient-to-b from-[#8AC617] to-[#63710B]"
                      : "border-[rgba(92,92,92,0.14)]")
                  }
                />
              );
            })}

            {/* Extra si se pasó del mínimo semanal */}
            {hasExtra && (
              <div
                className={
                  "rounded-full h-[16px] w-[16px] border-[3px] border-[#90AB3A] bg-gradient-to-b from-[#E6FFBE] to-[#9FFF00]"
                }
                title="Entrenamientos extra esta semana"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center">
          <div className="text-2xl text-gray-300 text-center bg-[linear-gradient(to_bottom,#787878,#424242)] w-11 h-11 rounded-full flex items-center justify-center">
            {member.commonStreak}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="text-2xl text-gray-300 text-center bg-[linear-gradient(to_bottom,#8DCD19,#616C0B)] w-11 h-11 rounded-full flex items-center justify-center">
            {member.goldenStreak}
          </div>
        </div>
      </div>
    </div>
  );
}