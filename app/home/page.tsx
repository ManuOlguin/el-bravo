import type { Metadata } from "next";
import { localDateOf } from "@/src/lib/time";
import { requirePageUser } from "@/src/server/auth/dal";
import { getUserStats } from "@/src/server/stats";
import { getFriendsFeed, getFriendsLatestWithPhoto } from "@/src/server/social/feed";
import { followingIds, getFollowSuggestions, relationsFor } from "@/src/server/social/follows";
import { Greeting } from "@/src/features/home/Greeting";
import { QuickStart } from "@/src/features/home/QuickStart";
import { WeekProgress } from "@/src/features/home/WeekProgress";
import { StreakCard } from "@/src/features/home/StreakCard";
import { GroupStandingsStrip } from "@/src/features/home/GroupStandingsStrip";
import { HomeEmptyState } from "@/src/features/home/HomeEmptyState";
import { FriendsFeed } from "@/src/features/home/FriendsFeed";
import { getHomeGroupStandings, getQuickRoutines } from "@/src/features/home/queries";
import { greetingMessage } from "@/src/features/home/logic";
import { HomeFeed } from "@/src/features/notifications/HomeFeed";
import { HomeFooter } from "@/src/features/home/HomeFooter";
import { pickQuote } from "@/src/features/home/quotes";

export const metadata: Metadata = { title: "Inicio" };

/** Una frase distinta en cada visita (la página es dinámica: se elige en cada request). */
const randomQuote = () => pickQuote(Math.random());

export default async function HomePage() {
  const user = await requirePageUser();
  const now = new Date();

  const [stats, standings, routines, feed, photos, following] = await Promise.all([
    getUserStats(user.id, { now }),
    getHomeGroupStandings(user.id, now),
    getQuickRoutines(user.id, 3),
    getFriendsFeed(user.id, { limit: 10 }),
    getFriendsLatestWithPhoto(user.id, 12),
    followingIds(user.id),
  ]);

  const suggestionsRaw = following.length === 0 ? await getFollowSuggestions(user.id, 5) : [];
  const relations = await relationsFor(
    user.id,
    suggestionsRaw.map((u) => u.id)
  );
  const suggestions = suggestionsRaw.map((u) => ({ ...u, relation: relations.get(u.id) ?? { isFollowing: false, followsMe: false } }));

  const today = localDateOf(now, user.timezone);
  const isNew = stats.totals.workouts === 0;
  const viewer = { id: user.id, name: user.name };

  return (
    <div className="mx-auto max-w-screen-sm space-y-5">
      <Greeting
        name={user.name}
        photoUrl={user.photoUrl}
        message={greetingMessage({
          workoutsThisWeek: stats.thisWeek.workouts,
          goal: stats.thisWeek.goal,
          currentStreakWeeks: stats.currentStreakWeeks,
          totalWorkouts: stats.totals.workouts,
          days: stats.thisWeek.days,
          today,
        })}
      />

      <QuickStart routines={routines.top} />

      {isNew ? (
        <HomeEmptyState hasGroup={standings.groupCount > 0} hasRoutine={routines.total > 0} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <WeekProgress days={stats.thisWeek.days} today={today} workouts={stats.thisWeek.workouts} goal={stats.thisWeek.goal} />
          <StreakCard current={stats.currentStreakWeeks} best={stats.bestStreakWeeks} activeWeeks={stats.activeWeeksStreak} goal={stats.thisWeek.goal} />
        </div>
      )}

      <GroupStandingsStrip cards={standings.cards} />

      <FriendsFeed feed={feed} photos={photos} followingCount={following.length} suggestions={suggestions} viewer={viewer} viewerTz={user.timezone} />

      <HomeFeed userId={user.id} tz={user.timezone} />

      <HomeFooter quote={randomQuote()} />
    </div>
  );
}
