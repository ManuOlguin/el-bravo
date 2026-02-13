"use client";

import { useRouter } from "next/navigation";
import GroupSeasonActivitiesCard from "./GroupSeasonActivitiesCard";
type Props = {
  activities: any[];
};

export default function GroupSeasonActivities({ activities }: Props) {
  const router = useRouter();
  console.log("Activities in GroupSeasonActivities:", activities);
  return (
<div className="w-full bg-surface rounded-lg flex py-3 px-4 flex-col gap-2 overflow-auto max-h-[400px] minimal-scrollbar">
 {activities.map((activity, index) => (
  <>    
  <div className="flex items-center w-full mb-1">
      <div className="flex-1 h-px bg-gray-600"></div>
      <div className="px-4 text-sm text-gray-400">Hoy</div>
      <div className="flex-1 h-px bg-gray-600"></div>
      </div>
  <GroupSeasonActivitiesCard key={index} activity={activity} />
  <div>
    {/* divisor de dias, linea recta con texto centro al medio*/}
    <div className="flex items-center w-full my-1">
      <div className="flex-1 h-px bg-gray-600"></div>
      <div className="px-4 text-sm text-gray-400">Ayer</div>
      <div className="flex-1 h-px bg-gray-600"></div>
      </div>
  </div>
    <GroupSeasonActivitiesCard key={index + 1} activity={activity} />
    <GroupSeasonActivitiesCard key={index +2} activity={activity} />
</>
    
  ))}
</div>

  );
}
