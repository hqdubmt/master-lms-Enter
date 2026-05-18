import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail } from "@lms/utils";
import { prisma } from "@lms/database";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { LessonService } from "../services/lesson.service.js";
import {
  CreateLessonSchema,
  SaveContentSchema,
  CreateQuizSchema,
  SubmitQuizSchema,
} from "../schemas/learning.schema.js";

export const lessonRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/modules/:moduleId/lessons/:id — get lesson with content
  app.get(
    "/modules/:moduleId/lessons/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      try {
        const result = await LessonService.getContent(lessonId, schoolId);
        if (!result) return reply.code(404).send(fail("Lesson not found"));
        reply.send(ok(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/modules/:moduleId/lessons — create lesson
  app.post(
    "/modules/:moduleId/lessons",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (
      request: FastifyRequest<{ Params: { moduleId: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const moduleId = parseInt(request.params.moduleId, 10);
      if (isNaN(moduleId)) return reply.code(400).send(fail("Invalid module ID"));

      const parsed = CreateLessonSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      // Verify module belongs to a course owned by this school
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        include: { course: { select: { schoolId: true } } },
      });
      if (!module || module.course.schoolId !== schoolId) {
        return reply.code(404).send(fail("Module not found"));
      }

      try {
        const lesson = await prisma.lesson.create({
          data: {
            moduleId,
            title: parsed.data.title,
            order: parsed.data.order,
            contentType: parsed.data.contentType,
          },
        });
        reply.code(201).send(ok(lesson, "Lesson created"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // PUT /api/modules/:moduleId/lessons/:id/content — save content blocks
  app.put(
    "/modules/:moduleId/lessons/:id/content",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      const parsed = SaveContentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      try {
        const doc = await LessonService.saveContent(
          lessonId,
          schoolId,
          parsed.data.blocks
        );
        if (!doc) return reply.code(404).send(fail("Lesson not found"));
        reply.send(ok(doc, "Content saved"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/modules/:moduleId/lessons/:id/complete — mark lesson complete
  app.post(
    "/modules/:moduleId/lessons/:id/complete",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { sub: userId, schoolId } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      // Get courseId from lesson -> module -> course
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: { include: { course: { select: { id: true, schoolId: true } } } },
        },
      });
      if (!lesson || lesson.module.course.schoolId !== schoolId) {
        return reply.code(404).send(fail("Lesson not found"));
      }

      try {
        const progress = await LessonService.markComplete(
          userId,
          lessonId,
          lesson.module.course.id,
          schoolId
        );
        reply.send(ok(progress, "Lesson marked as complete"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(400).send(fail(message));
      }
    }
  );

  // GET /api/modules/:moduleId/lessons/:id/quiz — get quiz (no answers for students)
  app.get(
    "/modules/:moduleId/lessons/:id/quiz",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId, role } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      const includeAnswers =
        role === "SCHOOL_ADMIN" || role === "TEACHER" || role === "SUPER_ADMIN";

      try {
        const quiz = await LessonService.getQuiz(
          lessonId,
          schoolId,
          includeAnswers
        );
        if (!quiz) return reply.code(404).send(fail("Quiz not found"));
        reply.send(ok(quiz));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );

  // POST /api/modules/:moduleId/lessons/:id/quiz/submit — submit quiz answers
  app.post(
    "/modules/:moduleId/lessons/:id/quiz/submit",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { sub: userId } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      const parsed = SubmitQuizSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      try {
        const result = await LessonService.submitQuiz(
          userId,
          lessonId,
          parsed.data.answers
        );
        reply.send(ok(result, `Quiz submitted — score: ${result.score}%`));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(400).send(fail(message));
      }
    }
  );

  // POST /api/modules/:moduleId/lessons/:id/quiz — create/update quiz (teachers/admins)
  app.post(
    "/modules/:moduleId/lessons/:id/quiz",
    { preHandler: requireRole("SCHOOL_ADMIN", "TEACHER") },
    async (
      request: FastifyRequest<{ Params: { moduleId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { schoolId } = request.user;
      const lessonId = parseInt(request.params.id, 10);
      if (isNaN(lessonId)) return reply.code(400).send(fail("Invalid lesson ID"));

      const parsed = CreateQuizSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send(fail(parsed.error.message));
      }

      try {
        const quiz = await LessonService.saveQuiz(
          lessonId,
          schoolId,
          parsed.data
        );
        if (!quiz) return reply.code(404).send(fail("Lesson not found"));
        reply.send(ok(quiz, "Quiz saved"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        reply.code(500).send(fail(message));
      }
    }
  );
};
