"use client";

import { useRouter } from "next/navigation";

type Props = {
  member: any;
};

export default function GroupSeasonMembersCard({ member }: Props) {
  const router = useRouter();
  return (

     
        <div
          className="bg-surface2 px-3 py-2 rounded-lg  flex justify-between "
        >
          <div className="flex ">
            <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden mr-3">
              {member.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-12 h-12  object-cover"
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
              <div className="flex gap-0.5">
                <div className="rounded-full h-[16px] w-[16px] border-3 border-[rgba(92,92,92,0.14)]"></div>
                <div className="rounded-full h-[16px] w-[16px] border-3 border-[rgba(92,92,92,0.14)]"></div>
                <div className="rounded-full h-[16px] w-[16px] border-3 border-[rgba(92,92,92,0.14)]"></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <div className="text-2xl text-gray-300 text-center bg-[linear-gradient(to_bottom,#8DCD19,#616C0B)] w-11 h-11 rounded-full flex items-center justify-center">
                {member.goldenStreak}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-2xl text-gray-300 text-center bg-[linear-gradient(to_bottom,#787878,#424242)] w-11 h-11 rounded-full flex items-center justify-center">
                {member.commonStreak}
              </div>
            </div>
          </div>
        
      </div>);
}
