import { prisma } from "@lms/database";
import type { UserPoints, Badge } from "@lms/database";
import { redis } from "../lib/redis.js";

export interface LeaderboardEntry {
  userId: number;
  total: number;
  level: number;
  rank: number;
}

const BADGE_MILESTONES: Array<{ minPoints: number; name: string }> = [
  { minPoints: 100, name: "starter" },
  { minPoints: 500, name: "learner" },
  { minPoints: 1000, name: "expert" },
];

export function getLevelFromPoints(points: number): number {
  return Math.max(1, Math.floor(points / 200) + 1);
}

export async function addPoints(
  userId: number,
  schoolId: number,
  points: number,
  reason: string
): Promise<UserPoints> {
  // Upsert user points in DB
  const userPoints = await prisma.userPoints.upsert({
    where: { userId },
    update: { total: { increment: points } },
    create: { userId, total: points, level: 1 },
  });

  const newTotal = userPoints.total;
  const newLevel = getLevelFromPoints(newTotal);

  // Update level if changed
  if (newLevel !== userPoints.level) {
    await prisma.userPoints.update({
      where: { userId },
      data: { level: newLevel },
    });
    userPoints.level = newLevel;
  }

  // Update Redis leaderboard sorted set
  const leaderboardKey = `leaderboard:${schoolId}`;
  await redis.zadd(leaderboardKey, newTotal, userId.toString());

  console.log(
    `[gamification] User ${userId} earned ${points} points (${reason}). Total: ${newTotal}`
  );

  return { ...userPoints, total: newTotal, level: newLevel };
}

export async function getLeaderboard(
  schoolId: number,
  limit = 10
): Promise<LeaderboardEntry[]> {
  const leaderboardKey = `leaderboard:${schoolId}`;

  // ZREVRANGE with WITHSCORES returns [member, score, member, score, ...]
  const raw = await redis.zrevrange(leaderboardKey, 0, limit - 1, "WITHSCORES");

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const userId = parseInt(raw[i] ?? "0", 10);
    const total = parseInt(raw[i + 1] ?? "0", 10);
    const level = getLevelFromPoints(total);
    const rank = i / 2 + 1;
    entries.push({ userId, total, level, rank });
  }

  return entries;
}

export async function checkBadges(
  userId: number,
  userPoints: UserPoints
): Promise<Badge[]> {
  const awardedBadges: Badge[] = [];

  for (const milestone of BADGE_MILESTONES) {
    if (userPoints.total < milestone.minPoints) continue;

    const badge = await prisma.badge.findUnique({
      where: { name: milestone.name },
    });

    if (!badge) continue;

    // Check if user already has this badge (via a UserBadge junction table if it exists,
    // or skip since schema doesn't define one — we just return qualifying badges)
    awardedBadges.push(badge);
  }

  return awardedBadges;
}

export async function getUserRank(
  userId: number,
  schoolId: number
): Promise<number> {
  const leaderboardKey = `leaderboard:${schoolId}`;
  const rank = await redis.zrevrank(leaderboardKey, userId.toString());
  // zrevrank returns null if not found, 0-indexed otherwise
  return rank !== null ? rank + 1 : -1;
}

export async function getUserStats(
  userId: number,
  schoolId: number
): Promise<{
  points: UserPoints;
  rank: number;
  badges: Badge[];
}> {
  const points = await prisma.userPoints.findUnique({ where: { userId } });
  const defaultPoints: UserPoints = { id: 0, userId, total: 0, level: 1 };
  const userPoints = points ?? defaultPoints;

  const [rank, badges] = await Promise.all([
    getUserRank(userId, schoolId),
    checkBadges(userId, userPoints),
  ]);

  return { points: userPoints, rank, badges };
}
