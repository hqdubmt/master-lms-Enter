import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail } from "@lms/utils";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import {
  getLeaderboard,
  getUserStats,
  addPoints,
} from "../services/gamification.service.js";

const LeaderboardQuerySchema = z.object({
  schoolId: z.string().regex(/^\d+$/),
  limit: z.string().optional(),
});

const AwardPointsBodySchema = z.object({
  userId: z.number().int().positive(),
  points: z.number().int().positive().max(10000),
  reason: z.string().min(1).max(200),
});

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  // GET /leaderboard?schoolId=N
  app.get<{ Querystring: { schoolId?: string; limit?: string } }>(
    "/leaderboard",
    async (request, reply) => {
      const parsed = LeaderboardQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(fail("schoolId is required and must be a number"));
      }

      const schoolId = parseInt(parsed.data.schoolId, 10);
      const limit = parseInt(parsed.data.limit ?? "10", 10);

      try {
        const leaderboard = await getLeaderboard(schoolId, Math.min(limit, 100));
        return reply.send(ok(leaderboard));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch leaderboard"));
      }
    }
  );

  // GET /my-stats
  app.get(
    "/my-stats",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const stats = await getUserStats(request.user.sub, request.user.schoolId);
        return reply.send(ok(stats));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch user stats"));
      }
    }
  );

  // POST /award — requireRole(SCHOOL_ADMIN, TEACHER)
  app.post<{ Body: z.infer<typeof AwardPointsBodySchema> }>(
    "/award",
    { preHandler: [requireAuth, requireRole("SCHOOL_ADMIN", "TEACHER")] },
    async (request, reply) => {
      const parsed = AwardPointsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      try {
        const userPoints = await addPoints(
          parsed.data.userId,
          request.user.schoolId,
          parsed.data.points,
          parsed.data.reason
        );
        return reply.send(ok(userPoints, "Points awarded successfully"));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to award points"));
      }
    }
  );
}
