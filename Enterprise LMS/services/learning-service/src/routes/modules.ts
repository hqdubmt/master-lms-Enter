import type { FastifyPluginAsync } from "fastify";
import { ok, fail } from "@lms/utils";
import { prisma } from "@lms/database";
import { requireRole } from "../middleware/requireAuth.js";
import {
  CreateModuleSchema,
  UpdateModuleSchema,
} from "../schemas/learning.schema.js";

export const moduleRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/courses/:courseId/modules — create module
  app.post<{ Params: { courseId: string } }>(
    "/courses/:courseId/modules",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (request, reply) => {
      const { schoolId } = request.user;
      const courseId = parseInt(request.params.courseId, 10);
      if (isNaN(courseId)) return reply.code(400).send(fail("Invalid course ID"));

      const parsed = CreateModuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      // Verify course belongs to school
      const course = await prisma.course.findFirst({
        where: { id: courseId, schoolId },
        select: { id: true },
      });
      if (!course) return reply.code(404).send(fail("Course not found"));

      try {
        const module = await prisma.module.create({
          data: {
            courseId,
            title: parsed.data.title,
            order: parsed.data.order,
          },
        });
        reply.code(201).send(ok(module, "Module created"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // PATCH /api/courses/:courseId/modules/:moduleId — update module
  app.patch<{ Params: { courseId: string; moduleId: string } }>(
    "/courses/:courseId/modules/:moduleId",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (request, reply) => {
      const { schoolId } = request.user;
      const courseId = parseInt(request.params.courseId, 10);
      const moduleId = parseInt(request.params.moduleId, 10);
      if (isNaN(courseId) || isNaN(moduleId)) {
        return reply.code(400).send(fail("Invalid ID"));
      }

      const parsed = UpdateModuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      // Verify course belongs to school
      const course = await prisma.course.findFirst({
        where: { id: courseId, schoolId },
        select: { id: true },
      });
      if (!course) return reply.code(404).send(fail("Course not found"));

      try {
        const result = await prisma.module.updateMany({
          where: { id: moduleId, courseId },
          data: {
            ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
            ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
          },
        });
        if (result.count === 0) {
          return reply.code(404).send(fail("Module not found"));
        }
        reply.send(ok({ updated: true }, "Module updated"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // DELETE /api/courses/:courseId/modules/:moduleId — delete module
  app.delete<{ Params: { courseId: string; moduleId: string } }>(
    "/courses/:courseId/modules/:moduleId",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (request, reply) => {
      const { schoolId } = request.user;
      const courseId = parseInt(request.params.courseId, 10);
      const moduleId = parseInt(request.params.moduleId, 10);
      if (isNaN(courseId) || isNaN(moduleId)) {
        return reply.code(400).send(fail("Invalid ID"));
      }

      // Verify course belongs to school
      const course = await prisma.course.findFirst({
        where: { id: courseId, schoolId },
        select: { id: true },
      });
      if (!course) return reply.code(404).send(fail("Course not found"));

      try {
        const result = await prisma.module.deleteMany({
          where: { id: moduleId, courseId },
        });
        if (result.count === 0) {
          return reply.code(404).send(fail("Module not found"));
        }
        reply.send(ok({ deleted: true }, "Module deleted"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );
};
