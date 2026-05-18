import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail } from "@lms/utils";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getCourseStats,
  getUserActivity,
  getSchoolDashboard,
} from "../services/analytics.service.js";

const CourseParamsSchema = z.object({ id: z.string().regex(/^\d+$/) });
const UserParamsSchema = z.object({ id: z.string().regex(/^\d+$/) });
const ActivityQuerySchema = z.object({ days: z.string().optional() });

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // GET /courses/:id/stats
  app.get<{
    Params: { id: string };
  }>(
    "/courses/:id/stats",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = CourseParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send(fail("Invalid course id"));
      }

      const courseId = parseInt(parsed.data.id, 10);
      const schoolId = request.user.schoolId;

      try {
        const stats = await getCourseStats(courseId, schoolId);
        return reply.send(ok(stats));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch course stats"));
      }
    }
  );

  // GET /users/:id/activity?days=30
  app.get<{
    Params: { id: string };
    Querystring: { days?: string };
  }>(
    "/users/:id/activity",
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsParsed = UserParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.code(400).send(fail("Invalid user id"));
      }

      const queryParsed = ActivityQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply.code(400).send(fail("Invalid query params"));
      }

      const userId = parseInt(paramsParsed.data.id, 10);
      const days = parseInt(queryParsed.data.days ?? "30", 10);

      // Non-admin users can only view their own activity
      if (
        request.user.role !== "SUPER_ADMIN" &&
        request.user.role !== "SCHOOL_ADMIN" &&
        request.user.sub !== userId
      ) {
        return reply.code(403).send(fail("Forbidden"));
      }

      try {
        const activity = await getUserActivity(userId, days);
        return reply.send(ok(activity));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch user activity"));
      }
    }
  );

  // GET /school/dashboard
  app.get(
    "/school/dashboard",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (
        request.user.role !== "SUPER_ADMIN" &&
        request.user.role !== "SCHOOL_ADMIN"
      ) {
        return reply.code(403).send(fail("Forbidden: insufficient permissions"));
      }

      try {
        const dashboard = await getSchoolDashboard(request.user.schoolId);
        return reply.send(ok(dashboard));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch school dashboard"));
      }
    }
  );
}
