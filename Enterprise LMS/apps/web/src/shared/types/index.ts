import type { UserRole } from "@lms/types";

export type { UserRole };

export interface UserProfile {
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  schoolId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfile | null;
  school?: {
    id: number;
    name: string;
    domain: string | null;
    plan: string;
  };
}

export interface Course {
  id: number;
  schoolId: number;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: number;
  moduleId: number;
  title: string;
  order: number;
  contentType: "TEXT" | "VIDEO" | "QUIZ" | "INTERACTIVE";
}

export interface Module {
  id: number;
  courseId: number;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseWithModules extends Course {
  modules: Module[];
}

export interface ContentBlock {
  type: string;
  content: unknown;
  order: number;
}

export interface LessonContent {
  blocks: ContentBlock[];
}

export interface LessonWithContent extends Lesson {
  content?: LessonContent | null;
}

export interface QuizAnswer {
  questionIndex: number;
  yourAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation?: string;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
}

export interface Quiz {
  questions: QuizQuestion[];
}

export interface QuizResult {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  results: QuizAnswer[];
}

export interface Enrollment {
  id: number;
  courseId: number;
  userId: number;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  enrolledAt: string;
  completedAt?: string | null;
  course?: Course;
}

export interface Badge {
  id?: number;
  name: string;
  description: string;
  iconUrl: string;
}

export interface UserStats {
  points: number;
  level: number;
  rank: number;
  badges: Badge[];
}

export interface LeaderboardEntry {
  userId: number;
  displayName: string;
  points: number;
  level: number;
  rank: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  type: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  schoolName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  schoolId: number;
}
