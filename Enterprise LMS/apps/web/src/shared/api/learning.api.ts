import { apiClient } from "./client";
import type {
  Course,
  CourseWithModules,
  Enrollment,
  LessonWithContent,
  Quiz,
  QuizResult,
} from "../types";
import type { ApiResponse, PaginatedResponse } from "@lms/types";

export interface GetCoursesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  enrolled?: boolean;
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export const learningApi = {
  async getCourses(
    params?: GetCoursesParams
  ): Promise<PaginatedResponse<Course>> {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<Course>>>(
      "/api/learning/courses",
      { params }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch courses");
    }
    return res.data.data;
  },

  async getCourse(id: number): Promise<CourseWithModules> {
    const res = await apiClient.get<ApiResponse<CourseWithModules>>(
      `/api/learning/courses/${id}`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch course");
    }
    return res.data.data;
  },

  async createCourse(data: CreateCourseInput): Promise<Course> {
    const res = await apiClient.post<ApiResponse<Course>>(
      "/api/learning/courses",
      data
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to create course");
    }
    return res.data.data;
  },

  async updateCourse(id: number, data: UpdateCourseInput): Promise<Course> {
    const res = await apiClient.patch<ApiResponse<Course>>(
      `/api/learning/courses/${id}`,
      data
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to update course");
    }
    return res.data.data;
  },

  async deleteCourse(id: number): Promise<void> {
    await apiClient.delete(`/api/learning/courses/${id}`);
  },

  async enroll(courseId: number): Promise<Enrollment> {
    const res = await apiClient.post<ApiResponse<Enrollment>>(
      `/api/learning/courses/${courseId}/enroll`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to enroll");
    }
    return res.data.data;
  },

  async getLesson(
    moduleId: number,
    lessonId: number
  ): Promise<LessonWithContent> {
    const res = await apiClient.get<ApiResponse<LessonWithContent>>(
      `/api/learning/modules/${moduleId}/lessons/${lessonId}`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch lesson");
    }
    return res.data.data;
  },

  async completeLesson(moduleId: number, lessonId: number): Promise<void> {
    await apiClient.post(
      `/api/learning/modules/${moduleId}/lessons/${lessonId}/complete`
    );
  },

  async getQuiz(moduleId: number, lessonId: number): Promise<Quiz> {
    const res = await apiClient.get<ApiResponse<Quiz>>(
      `/api/learning/modules/${moduleId}/lessons/${lessonId}/quiz`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch quiz");
    }
    return res.data.data;
  },

  async submitQuiz(
    moduleId: number,
    lessonId: number,
    answers: number[]
  ): Promise<QuizResult> {
    const res = await apiClient.post<ApiResponse<QuizResult>>(
      `/api/learning/modules/${moduleId}/lessons/${lessonId}/quiz/submit`,
      { answers }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to submit quiz");
    }
    return res.data.data;
  },

  async publishCourse(id: number): Promise<Course> {
    const res = await apiClient.post<ApiResponse<Course>>(
      `/api/learning/courses/${id}/publish`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to publish course");
    }
    return res.data.data;
  },

  async getMyEnrollments(): Promise<Enrollment[]> {
    const res = await apiClient.get<ApiResponse<Enrollment[]>>(
      "/api/learning/enrollments/me"
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch enrollments");
    }
    return res.data.data;
  },

  async getAdminUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<unknown>>>(
      "/api/auth/users",
      { params }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error ?? "Failed to fetch users");
    }
    return res.data.data;
  },
};
