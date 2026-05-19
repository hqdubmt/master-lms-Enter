import jwt from "jsonwebtoken";
import type { JwtPayload } from "@lms/types";

export class JwtService {
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;
  private readonly expiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET ?? "";
    this.refreshSecret = process.env.JWT_REFRESH_SECRET ?? "";
    this.expiresIn = process.env.JWT_EXPIRES_IN ?? "15m";
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

    if (!this.jwtSecret) throw new Error("JWT_SECRET env var is required");
    if (!this.refreshSecret)
      throw new Error("JWT_REFRESH_SECRET env var is required");
  }

  signAccessToken(payload: JwtPayload): string {
    const { iat: _iat, exp: _exp, ...claims } = payload;
    return jwt.sign(claims, this.jwtSecret, {
      expiresIn: this.expiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  signRefreshToken(payload: { sub: number }): string {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.jwtSecret);
    if (typeof decoded === "string") {
      throw new Error("Invalid access token");
    }
    return decoded as unknown as JwtPayload;
  }

  verifyRefreshToken(token: string): { sub: number } {
    const decoded = jwt.verify(token, this.refreshSecret);
    if (typeof decoded === "string") {
      throw new Error("Invalid refresh token");
    }
    const payload = decoded as jwt.JwtPayload;
    if (typeof payload.sub !== "number") {
      throw new Error("Invalid refresh token payload");
    }
    return { sub: payload.sub };
  }
}
