import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@lms/types";
import { fail } from "@lms/utils";

export function requireRole(...roles: UserRole[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      reply.code(401).send(fail("Unauthorized"));
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.code(403).send(fail("Forbidden: insufficient permissions"));
    }
  };
}
