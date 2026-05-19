import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail, paginate, getPaginationArgs } from "@lms/utils";
import { prisma } from "@lms/database";
import { UpdateUserSchema, CreateUserByAdminSchema, BulkCreateUserSchema } from "../schemas/auth.schema";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { PasswordService } from "../services/password.service";

const DEFAULT_PASSWORD = "Password@123";
const passwordService = new PasswordService();

export const userRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook("preHandler", requireAuth);

  // POST / — create a single user in same school (admin/teacher only)
  app.post(
    "/",
    { preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = CreateUserByAdminSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      const { schoolId } = request.user;
      const { name, email, password, role } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { schoolId_email: { schoolId, email } } });
      if (existing) return reply.code(409).send(fail("Email đã tồn tại trong trường này"));

      const hashedPassword = await passwordService.hash(password);
      const user = await prisma.user.create({
        data: {
          schoolId,
          email,
          password: hashedPassword,
          role,
          profile: { create: { displayName: name } },
        },
        select: {
          id: true, schoolId: true, email: true, role: true, isActive: true,
          createdAt: true, updatedAt: true,
          profile: { select: { displayName: true, avatarUrl: true, phone: true, bio: true } },
        },
      });

      return reply.code(201).send(ok(user, "Tạo tài khoản thành công"));
    }
  );

  // POST /bulk — bulk create users in same school
  app.post(
    "/bulk",
    { preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = BulkCreateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      const { schoolId } = request.user;
      const results: Array<{ email: string; status: "created" | "skipped"; reason?: string }> = [];

      for (const u of parsed.data.users) {
        const existing = await prisma.user.findUnique({ where: { schoolId_email: { schoolId, email: u.email } } });
        if (existing) {
          results.push({ email: u.email, status: "skipped", reason: "Email đã tồn tại" });
          continue;
        }
        const hashedPassword = await passwordService.hash(u.password);
        await prisma.user.create({
          data: {
            schoolId,
            email: u.email,
            password: hashedPassword,
            role: u.role,
            profile: { create: { displayName: u.name } },
          },
        });
        results.push({ email: u.email, status: "created" });
      }

      const created = results.filter((r) => r.status === "created").length;
      return reply.send(ok(results, `Đã tạo ${created}/${parsed.data.users.length} tài khoản`));
    }
  );

  // POST /:id/reset-password — reset password to default
  app.post<{ Params: { id: string } }>(
    "/:id/reset-password",
    { preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")] },
    async (request, reply) => {
      const userId = parseInt(request.params.id, 10);
      if (isNaN(userId)) return reply.code(400).send(fail("Invalid user ID"));

      const { schoolId } = request.user;
      const existingUser = await prisma.user.findFirst({ where: { id: userId, schoolId } });
      if (!existingUser) return reply.code(404).send(fail("User not found"));

      const hashedPassword = await passwordService.hash(DEFAULT_PASSWORD);
      await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

      return reply.send(ok({ defaultPassword: DEFAULT_PASSWORD }, "Mật khẩu đã được đặt lại"));
    }
  );

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

      const where: NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"] = {
        schoolId,
      };

      if (query.role) {
        where!.role = query.role as NonNullable<
          NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"]
        >["role"];
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
  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN")],
    },
    async (request, reply) => {
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

      const { role, isActive, ...profileData } = parsed.data;

      // Admins can update role and isActive; non-admins cannot
      if ((role || isActive !== undefined) && !isAdmin) {
        return reply
          .code(403)
          .send(fail("Forbidden: only admins can change user roles or status"));
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(role ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
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
  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("SUPER_ADMIN", "SCHOOL_ADMIN")],
    },
    async (request, reply) => {
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
