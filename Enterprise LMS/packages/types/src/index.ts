// ─── Auth ────────────────────────────────────────────────

export interface JwtPayload {
  sub: number;       // userId
  schoolId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

// ─── API Response ────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Events (Kafka / NATS) ───────────────────────────────

export interface BaseEvent {
  eventId: string;
  timestamp: string;
  schoolId: number;
}

export interface UserCreatedEvent extends BaseEvent {
  type: "user.created";
  userId: number;
  email: string;
  role: UserRole;
}

export interface LessonCompletedEvent extends BaseEvent {
  type: "lesson.completed";
  userId: number;
  lessonId: string;
  courseId: number;
  durationMs: number;
}

export interface QuizSubmittedEvent extends BaseEvent {
  type: "quiz.submitted";
  userId: number;
  quizId: string;
  score: number;
  maxScore: number;
}

export type AppEvent = UserCreatedEvent | LessonCompletedEvent | QuizSubmittedEvent;

// ─── Realtime ────────────────────────────────────────────

export interface WsMessage<T = unknown> {
  event: string;
  data: T;
  roomId?: string;
}
