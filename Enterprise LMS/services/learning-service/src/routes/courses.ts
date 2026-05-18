import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail } from "@lms/utils";
import { CourseService } from "../services/course.service.js";
import { EnrollmentService } from "../services/enrollment.service.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  EnrollSchema,
} from "../schemas/learning.schema.js";

export const courseRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/courses — list courses
  // Published-only for students; all for admins/teachers
  app.get(
    "/",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { schoolId, role } = request.user;
      const publishedOnly = role === "STUDENT" || role === "PARENT";
      const query = request.query as {
        page?: string;
        pageSize?: string;
      };

      try {
        const result = await CourseService.list(schoolId, {
          ...query,
          publishedOnly,
        });
        reply.send(ok(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/courses — create course (SCHOOL_ADMIN | TEACHER)
  app.post(
    "/",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { schoolId } = request.user;
      const parsed = CreateCourseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      try {
        const course = await CourseService.create(schoolId, parsed.data);
        reply.code(201).send(ok(course, "Course created"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // GET /api/courses/:id — get course with modules + lessons
  app.get(
    "/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.code(400).send(fail("Invalid course ID"));

      try {
        const course = await CourseService.getById(id, schoolId);
        if (!course) return reply.code(404).send(fail("Course not found"));
        reply.send(ok(course));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // PATCH /api/courses/:id — update course (SCHOOL_ADMIN | TEACHER)
  app.patch(
    "/:id",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.code(400).send(fail("Invalid course ID"));

      const parsed = UpdateCourseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      try {
        const result = await CourseService.update(id, schoolId, parsed.data);
        if (result.count === 0) {
          return reply.code(404).send(fail("Course not found"));
        }
        reply.send(ok({ updated: true }, "Course updated"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // DELETE /api/courses/:id — soft delete (SCHOOL_ADMIN only)
  app.delete(
    "/:id",
    { preHandler: requireRole("SCHOOL_ADMIN") },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.code(400).send(fail("Invalid course ID"));

      try {
        const result = await CourseService.delete(id, schoolId);
        if (result.count === 0) {
          return reply.code(404).send(fail("Course not found"));
        }
        reply.send(ok({ deleted: true }, "Course archived"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/courses/:id/publish — publish (SCHOOL_ADMIN | TEACHER)
  app.post(
    "/:id/publish",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.code(400).send(fail("Invalid course ID"));

      try {
        const result = await CourseService.publish(id, schoolId);
        if (result.count === 0) {
          return reply.code(404).send(fail("Course not found"));
        }
        reply.send(ok({ published: true }, "Course published"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/courses/:id/enroll — enroll current user
  app.post(
    "/:id/enroll",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { sub: userId, schoolId } = request.user;
      const courseId = parseInt(request.params.id, 10);
      if (isNaN(courseId)) return reply.code(400).send(fail("Invalid course ID"));

      try {
        const enrollment = await EnrollmentService.enroll(
          userId,
          courseId,
          schoolId
        );
        reply.code(201).send(ok(enrollment, "Enrolled successfully"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(400).send(fail(message));
      }
    }
  );

  // GET /api/courses/my/enrollments — get current user's enrollments
  app.get(
    "/my/enrollments",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId, schoolId } = request.user;
      try {
        const enrollments = await EnrollmentService.getMyEnrollments(
          userId,
          schoolId
        );
        reply.send(ok(enrollments));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // GET /api/courses/:id/progress — get user's progress for a course
  app.get(
    "/:id/progress",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { sub: userId } = request.user;
      const courseId = parseInt(request.params.id, 10);
      if (isNaN(courseId))
        return reply.code(400).send(fail("Invalid course ID"));

      try {
        const progress = await EnrollmentService.getProgress(userId, courseId);
        if (!progress) return reply.code(404).send(fail("Course not found"));
        reply.send(ok(progress));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );
};
