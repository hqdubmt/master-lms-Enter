import { apiClient } from "./client";
import type { ChatMessage, SearchResult } from "../types";
import type { ApiResponse } from "@lms/types";

export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOption?: number;
}

export const aiApi = {
  async chat(
    message: string,
    history?: ChatMessage[],
    sessionId?: string
  ): Promise<{ reply: string; sessionId?: string }> {
    const res = await apiClient.post<
      ApiResponse<{ reply: string; sessionId?: string }>
    >("/api/ai/chat", { message, history, sessionId });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "AI chat failed");
    }
    return res.data.data;
  },

  async explain(text: string): Promise<{ explanation: string }> {
    const res = await apiClient.post<ApiResponse<{ explanation: string }>>(
      "/api/ai/explain",
      { text }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "AI explain failed");
    }
    return res.data.data;
  },

  async generateQuiz(
    text: string,
    count = 5
  ): Promise<{ questions: QuizQuestion[] }> {
    const res = await apiClient.post<
      ApiResponse<{ questions: QuizQuestion[] }>
    >("/api/ai/generate-quiz", { text, count });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Quiz generation failed");
    }
    return res.data.data;
  },

  async search(query: string): Promise<{ results: SearchResult[] }> {
    const res = await apiClient.post<ApiResponse<{ results: SearchResult[] }>>(
      "/api/ai/search",
      { query }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "AI search failed");
    }
    return res.data.data;
  },
};
