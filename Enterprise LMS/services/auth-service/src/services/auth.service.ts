import { prisma } from "@lms/database";
import type { Redis } from "ioredis";
import { randomUUID } from "crypto";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";
import { JwtService } from "./jwt.service";
import { PasswordService } from "./password.service";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function refreshKey(userId: number, tokenId: string): string {
  return `refresh:${userId}:${tokenId}`;
}

export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly redis: Redis
  ) {}

  async register(data: RegisterInput) {
    const existingSchool = data.domain
      ? await prisma.school.findUnique({ where: { domain: data.domain } })
      : null;

    if (existingSchool) {
      throw Object.assign(new Error("Domain already taken"), { statusCode: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: data.schoolName,
          domain: data.domain,
        },
      });

      const hashedPassword = await this.passwordService.hash(data.password);

      const user = await tx.user.create({
        data: {
          schoolId: school.id,
          email: data.email,
          password: hashedPassword,
          role: "SCHOOL_ADMIN",
        },
      });

      const profile = await tx.userProfile.create({
        data: {
          userId: user.id,
          displayName: data.name,
        },
      });

      return { school, user, profile };
    });

    const { user, profile } = result;
    const tokenId = randomUUID();

    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      schoolId: user.schoolId,
      role: user.role as import("@lms/types").UserRole,
    });

    const refreshToken = this.jwtService.signRefreshToken({ sub: user.id });

    await this.redis.setex(
      refreshKey(user.id, tokenId),
      REFRESH_TTL_SECONDS,
      refreshToken
    );

    const safeUser = {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        bio: profile.bio,
      },
    };

    return { user: safeUser, accessToken, refreshToken, tokenId };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: {
        schoolId_email: {
          schoolId: data.schoolId,
          email: data.email,
        },
      },
      include: { profile: true },
    });

    if (!user) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    if (!user.isActive) {
      throw Object.assign(new Error("Account is disabled"), { statusCode: 403 });
    }

    const passwordValid = await this.passwordService.verify(
      data.password,
      user.password
    );

    if (!passwordValid) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    const tokenId = randomUUID();

    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      schoolId: user.schoolId,
      role: user.role as import("@lms/types").UserRole,
    });

    const refreshToken = this.jwtService.signRefreshToken({ sub: user.id });

    await this.redis.setex(
      refreshKey(user.id, tokenId),
      REFRESH_TTL_SECONDS,
      refreshToken
    );

    const safeUser = {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            avatarUrl: user.profile.avatarUrl,
            phone: user.profile.phone,
            bio: user.profile.bio,
          }
        : null,
    };

    return { user: safeUser, accessToken, refreshToken, tokenId };
  }

  async logout(userId: number, tokenId: string): Promise<void> {
    await this.redis.del(refreshKey(userId, tokenId));
  }

  async refreshTokens(
    oldRefreshToken: string,
    userId: number,
    tokenId: string
  ) {
    const storedToken = await this.redis.get(refreshKey(userId, tokenId));

    if (!storedToken || storedToken !== oldRefreshToken) {
      throw Object.assign(new Error("Refresh token is invalid or expired"), {
        statusCode: 401,
      });
    }

    let decoded: { sub: number };
    try {
      decoded = this.jwtService.verifyRefreshToken(oldRefreshToken);
    } catch {
      await this.redis.del(refreshKey(userId, tokenId));
      throw Object.assign(new Error("Refresh token is expired"), {
        statusCode: 401,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.isActive) {
      await this.redis.del(refreshKey(userId, tokenId));
      throw Object.assign(new Error("User not found or inactive"), {
        statusCode: 401,
      });
    }

    // Rotate tokens — delete old, issue new
    await this.redis.del(refreshKey(userId, tokenId));

    const newTokenId = randomUUID();
    const newAccessToken = this.jwtService.signAccessToken({
      sub: user.id,
      schoolId: user.schoolId,
      role: user.role as import("@lms/types").UserRole,
    });
    const newRefreshToken = this.jwtService.signRefreshToken({ sub: user.id });

    await this.redis.setex(
      refreshKey(user.id, newTokenId),
      REFRESH_TTL_SECONDS,
      newRefreshToken
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenId: newTokenId,
    };
  }
}
