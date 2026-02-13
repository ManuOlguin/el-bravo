"use client";

import { useRouter } from "next/navigation";

type Props = {
  activity: any;
  key: number;
};

export default function GroupSeasonActivitiesCard({ activity }: Props) {
  const router = useRouter();
  console.log("Activities in GroupSeasonActivitiesCard:", activity);
  return (
    <div  className="bg-surface2 rounded-lg w-full flex min-h-[170px]">
      <div className="bg-surfacehover  h-full w-[150px] min-w-[150px] rounded-l-lg">{/* aca va foto del entrenamiento */}</div>
      <div className="px-4 py-3  h-min w-full ">
        <div className="flex justify-between w-full border-b-1 pb-1 border-white/40">
        <div className="flex flex-col justify-between"> 
        <div className="text-lg font-black text-white/90 ">
          {activity.user.name}
        </div>
        <div className="text-sm font-light text-white/40 ">2hs 32m</div>
      </div>
      <div className="flex flex-col justify-between">
        <div className="flex gap-[0.2em]  justify-end mt-1">
                <div className="rounded-full h-[18px] w-[18px] border-3 border-[rgba(92,92,92,0.14)]"></div>
                <div className="rounded-full h-[18px] w-[18px] border-3 border-[rgba(92,92,92,0.14)]"></div>
                <div className="rounded-full h-[18px] w-[18px] border-3 border-[rgba(92,92,92,0.14)]"></div>
              </div>
            <div className="text-sm font-light text-white/40 text-right mr-[0.1em] ">9:32 - 12:11</div>
      </div>
      </div>
      </div>
    </div>
  );
}
