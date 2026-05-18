import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail, paginate, getPaginationArgs } from "@lms/utils";
import { prisma } from "@lms/database";
import { UpdateUserSchema } from "../schemas/auth.schema";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const userRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook("preHandler", requireAuth);

  // GET / — list users in same school (paginated)
  app.get(
    "/",
    {
      preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN")],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        page?: string;
        pageSize?: string;
        role?: string;
        isActive?: string;
      };

      const { skip, take, page, pageSize } = getPaginationArgs(query);
      const { schoolId } = request.user;

      const where: Parameters<typeof prisma.user.findMany>[0]["where"] = {
        schoolId,
      };

      if (query.role) {
        where.role = query.role as Parameters<
          typeof prisma.user.findMany
        >[0]["where"]["role"];
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive === "true";
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            schoolId: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                phone: true,
                bio: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send(ok(paginate(users, total, page, pageSize)));
    }
  );

  // GET /:id — get single user by ID
  app.get(
    "/:id",
    {
      preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN")],
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id, 10);

      if (isNaN(userId)) {
        return reply.code(400).send(fail("Invalid user ID"));
      }

      const { schoolId } = request.user;

      const user = await prisma.user.findFirst({
        where: { id: userId, schoolId },
        select: {
          id: true,
          schoolId: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
              phone: true,
              bio: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send(fail("User not found"));
      }

      return reply.send(ok(user));
    }
  );

  // PATCH /:id — update user profile (same school)
  app.patch(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id, 10);

      if (isNaN(userId)) {
        return reply.code(400).send(fail("Invalid user ID"));
      }

      const { schoolId, role: requesterRole, sub: requesterId } = request.user;

      // Only admins can update other users; regular users can only update themselves
      const isAdmin =
        requesterRole === "SUPER_ADMIN" || requesterRole === "SCHOOL_ADMIN";

      if (!isAdmin && requesterId !== userId) {
        return reply
          .code(403)
          .send(fail("Forbidden: you can only update your own profile"));
      }

      const parsed = UpdateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      // Ensure target user belongs to same school
      const existingUser = await prisma.user.findFirst({
        where: { id: userId, schoolId },
      });

      if (!existingUser) {
        return reply.code(404).send(fail("User not found"));
      }

      const { role, ...profileData } = parsed.data;

      // Admins can update role; non-admins cannot
      if (role && !isAdmin) {
        return reply
          .code(403)
          .send(fail("Forbidden: only admins can change user roles"));
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(role ? { role } : {}),
          profile: {
            upsert: {
              create: profileData,
              update: profileData,
            },
          },
        },
        select: {
          id: true,
          schoolId: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
              phone: true,
              bio: true,
            },
          },
        },
      });

      return reply.send(ok(updatedUser, "User updated successfully"));
    }
  );

  // DELETE /:id — soft delete (set isActive=false)
  app.delete(
    "/:id",
    {
      preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN")],
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const userId = parseInt(request.params.id, 10);

      if (isNaN(userId)) {
        return reply.code(400).send(fail("Invalid user ID"));
      }

      const { schoolId, sub: requesterId } = request.user;

      if (requesterId === userId) {
        return reply
          .code(400)
          .send(fail("You cannot deactivate your own account"));
      }

      const existingUser = await prisma.user.findFirst({
        where: { id: userId, schoolId },
      });

      if (!existingUser) {
        return reply.code(404).send(fail("User not found"));
      }

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      return reply.send(ok(null, "User deactivated successfully"));
    }
  );
};
