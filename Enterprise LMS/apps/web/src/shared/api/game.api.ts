import { apiClient } from "./client";
import type { LeaderboardEntry, UserStats } from "../types";
import type { ApiResponse } from "@lms/types";

export const gameApi = {
  async getLeaderboard(schoolId?: number): Promise<LeaderboardEntry[]> {
    const res = await apiClient.get<ApiResponse<LeaderboardEntry[]>>(
      "/api/game/leaderboard",
      { params: schoolId ? { schoolId } : undefined }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch leaderboard");
    }
    return res.data.data;
  },

  async getMyStats(): Promise<UserStats> {
    const res = await apiClient.get<ApiResponse<UserStats>>(
      "/api/game/stats/me"
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch stats");
    }
    return res.data.data;
  },
};
