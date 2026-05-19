import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@lms/types";
import { fail } from "@lms/utils";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send(fail("Missing or invalid Authorization header"));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = process.env.JWT_SECRET ?? "";
    const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
    request.user = decoded;
  } catch {
    reply.code(401).send(fail("Unauthorized: token is invalid or expired"));
  }
}
