"use client";

import { useRouter } from "next/navigation";
import GroupSeasonMembersCard from "./GroupSeasonMembersCard";

type Props = {
  members: any[];
  weeklyRequired: number;
};

export default function GroupSeasonMembers({ members, weeklyRequired }: Props) {
  const router = useRouter();
  console.log("Members in GroupSeasonMembers:", members);
  return (
    <div className=" w-full bg-surface max-w-[400px] px-3 py-3 rounded-lg gap-2 flex flex-col overflow-auto max-h-[400px]">
      {members.map((member, index) => (
        <>         <GroupSeasonMembersCard key={index} member={member} weeklyRequired={weeklyRequired} />

 </>
      ))}
    </div>
              
  );
}
