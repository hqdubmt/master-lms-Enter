import { apiClient } from "./client";
import type { User, RegisterInput, LoginInput } from "../types";
import type { ApiResponse } from "@lms/types";

export const authApi = {
  async register(
    data: RegisterInput
  ): Promise<{ user: User; accessToken: string }> {
    const res = await apiClient.post<
      ApiResponse<{ user: User; accessToken: string }>
    >("/api/auth/register", data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Registration failed");
    }
    return res.data.data;
  },

  async login(
    data: LoginInput
  ): Promise<{ user: User; accessToken: string }> {
    const res = await apiClient.post<
      ApiResponse<{ user: User; accessToken: string }>
    >("/api/auth/login", data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Login failed");
    }
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/api/auth/logout");
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
    }
  },

  async refresh(): Promise<{ accessToken: string }> {
    const res = await apiClient.post<ApiResponse<{ accessToken: string }>>(
      "/api/auth/refresh"
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Token refresh failed");
    }
    return res.data.data;
  },

  async me(): Promise<User> {
    const res = await apiClient.get<ApiResponse<User>>("/api/auth/me");
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch user");
    }
    return res.data.data;
  },
};
