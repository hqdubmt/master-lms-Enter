import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ok, fail } from "@lms/utils";
import { prisma } from "@lms/database";
import { RegisterSchema, LoginSchema } from "../schemas/auth.schema";
import { requireAuth } from "../middleware/requireAuth";

const COOKIE_NAME = "refreshToken";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

// Cookie stores "tokenId:userId" so we can look up Redis without the JWT payload
function buildCookieValue(tokenId: string, userId: number): string {
  return `${tokenId}:${userId}`;
}

function parseCookieValue(
  value: string
): { tokenId: string; userId: number } | null {
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const userId = parseInt(parts[1], 10);
  if (isNaN(userId)) return null;
  return { tokenId: parts[0], userId };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /register
  app.post(
    "/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
      }

      let result: Awaited<ReturnType<typeof app.authService.register>>;
      try {
        result = await app.authService.register(parsed.data);
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number };
        return reply
          .code(e.statusCode ?? 500)
          .send(fail(e.message ?? "Registration failed"));
      }

      const { user, accessToken, refreshToken, tokenId } = result;

      reply.setCookie(
        COOKIE_NAME,
        buildCookieValue(tokenId, user.id),
        COOKIE_OPTS
      );

      return reply
        .code(201)
        .send(ok({ user, accessToken }, "Registration successful"));
    }
  );

  // POST /login
  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send(fail(parsed.error.errors.map((e) => e.message).join(", ")));
    }

    let result: Awaited<ReturnType<typeof app.authService.login>>;
    try {
      result = await app.authService.login(parsed.data);
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send(fail(e.message ?? "Login failed"));
    }

    const { user, accessToken, refreshToken, tokenId } = result;

    reply.setCookie(
      COOKIE_NAME,
      buildCookieValue(tokenId, user.id),
      COOKIE_OPTS
    );

    return reply.send(ok({ user, accessToken }, "Login successful"));
  });

  // POST /logout — requires auth
  app.post(
    "/logout",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookieValue = request.cookies[COOKIE_NAME];

      if (cookieValue) {
        const parsed = parseCookieValue(cookieValue);
        if (parsed) {
          try {
            await app.authService.logout(parsed.userId, parsed.tokenId);
          } catch {
            // Best-effort cleanup; proceed with logout
          }
        }
      }

      reply.clearCookie(COOKIE_NAME, { path: "/" });
      return reply.send(ok(null, "Logged out successfully"));
    }
  );

  // POST /refresh — reads refreshToken cookie
  app.post(
    "/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookieValue = request.cookies[COOKIE_NAME];

      if (!cookieValue) {
        return reply.code(401).send(fail("No refresh token provided"));
      }

      const parsed = parseCookieValue(cookieValue);
      if (!parsed) {
        return reply.code(401).send(fail("Invalid refresh token cookie"));
      }

      // We need the actual JWT stored in Redis; the cookie only carries tokenId+userId
      // Reconstruct: read the stored token from Redis then verify + rotate
      const storedRefreshJwt = await app.redis.get(
        `refresh:${parsed.userId}:${parsed.tokenId}`
      );

      if (!storedRefreshJwt) {
        return reply.code(401).send(fail("Refresh token expired or revoked"));
      }

      let result: Awaited<ReturnType<typeof app.authService.refreshTokens>>;
      try {
        result = await app.authService.refreshTokens(
          storedRefreshJwt,
          parsed.userId,
          parsed.tokenId
        );
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number };
        reply.clearCookie(COOKIE_NAME, { path: "/" });
        return reply
          .code(e.statusCode ?? 401)
          .send(fail(e.message ?? "Token refresh failed"));
      }

      const { accessToken } = result;

      reply.setCookie(
        COOKIE_NAME,
        buildCookieValue(result.tokenId, parsed.userId),
        COOKIE_OPTS
      );

      return reply.send(ok({ accessToken }, "Token refreshed"));
    }
  );

  // GET /me — requires auth
  app.get(
    "/me",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub } = request.user;

      const user = await prisma.user.findUnique({
        where: { id: sub },
        include: { profile: true, school: { select: { id: true, name: true, domain: true, plan: true } } },
      });

      if (!user) {
        return reply.code(404).send(fail("User not found"));
      }

      const safeUser = {
        id: user.id,
        schoolId: user.schoolId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        school: user.school,
        profile: user.profile
          ? {
              displayName: user.profile.displayName,
              avatarUrl: user.profile.avatarUrl,
              phone: user.profile.phone,
              bio: user.profile.bio,
            }
          : null,
      };

      return reply.send(ok(safeUser));
    }
  );
};
