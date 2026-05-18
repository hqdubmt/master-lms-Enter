import type { ApiResponse } from "@lms/types";

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function fail(error: string): ApiResponse {
  return { success: false, error };
}
