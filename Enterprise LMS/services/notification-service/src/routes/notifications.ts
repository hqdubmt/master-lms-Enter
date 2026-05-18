import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail } from "@lms/utils";
import { requireAuth } from "../middleware/requireAuth.js";
import { emailQueue } from "../consumers/events.consumer.js";

const SendEmailBodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
});

const EMAIL_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Sent when a new user account is created",
    variables: ["name", "email"],
  },
  {
    id: "course-enrolled",
    name: "Course Enrollment",
    description: "Sent when a user is enrolled in a course",
    variables: ["email", "courseName"],
  },
  {
    id: "quiz-result",
    name: "Quiz Result",
    description: "Sent when a user submits a quiz",
    variables: ["email", "score", "maxScore", "courseName"],
  },
];

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // POST /send — admin: manually send notification
  app.post<{
    Body: z.infer<typeof SendEmailBodySchema>;
  }>(
    "/send",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (
        request.user.role !== "SUPER_ADMIN" &&
        request.user.role !== "SCHOOL_ADMIN"
      ) {
        return reply.code(403).send(fail("Forbidden: insufficient permissions"));
      }

      const parsed = SendEmailBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      try {
        const job = await emailQueue.add("manual", {
          type: "manual",
          to: parsed.data.to,
          subject: parsed.data.subject,
          html: parsed.data.html,
        });

        return reply.send(ok({ jobId: job.id }, "Notification queued"));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to queue notification"));
      }
    }
  );

  // GET /templates — list email templates
  app.get(
    "/templates",
    { preHandler: requireAuth },
    async (_request, reply) => {
      return reply.send(ok(EMAIL_TEMPLATES));
    }
  );
}
