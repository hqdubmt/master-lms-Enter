import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@lms/types";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ success: false, error: "Unauthorized" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ success: false, error: "Unauthorized" });
      return;
    }
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ success: false, error: "Forbidden" });
    }
  };
}
