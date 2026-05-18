import type { FastifyRequest, FastifyReply } from "fastify";
import { fail } from "@lms/utils";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send(fail("Missing or invalid Authorization header"));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = request.server.jwtService.verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.code(401).send(fail("Unauthorized: token is invalid or expired"));
  }
}
