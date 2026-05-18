import { z } from "zod";

// ─── Course ──────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url("Invalid thumbnail URL").optional(),
  slug: z
    .string()
    .max(255)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
});

export const UpdateCourseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().optional(),
  slug: z
    .string()
    .max(255)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

// ─── Module ──────────────────────────────────────────────

export const CreateModuleSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  order: z.number().int().min(0),
});

export const UpdateModuleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  order: z.number().int().min(0).optional(),
});

// ─── Lesson ──────────────────────────────────────────────

export const CreateLessonSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  order: z.number().int().min(0),
  contentType: z.enum(["TEXT", "VIDEO", "QUIZ", "INTERACTIVE"]),
});

export const UpdateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  order: z.number().int().min(0).optional(),
  contentType: z.enum(["TEXT", "VIDEO", "QUIZ", "INTERACTIVE"]).optional(),
});

// ─── Enrollment ──────────────────────────────────────────

export const EnrollSchema = z.object({
  courseId: z.number().int().positive("Course ID must be a positive integer"),
});

// ─── Content blocks ──────────────────────────────────────

export const ContentBlockSchema = z.object({
  type: z.enum(["text", "video", "embed", "quiz"]),
  content: z.unknown(),
  order: z.number().int().min(0),
});

export const SaveContentSchema = z.object({
  blocks: z.array(ContentBlockSchema),
});

// ─── Quiz ────────────────────────────────────────────────

export const QuizQuestionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).min(2, "At least 2 options required"),
  correctIndex: z.number().int().min(0),
  explanation: z.string().optional(),
});

export const CreateQuizSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1, "At least one question required"),
});

export const SubmitQuizSchema = z.object({
  answers: z.array(z.number().int().min(0)),
});

// ─── Inferred types ──────────────────────────────────────

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;
export type EnrollInput = z.infer<typeof EnrollSchema>;
export type ContentBlockInput = z.infer<typeof ContentBlockSchema>;
export type SaveContentInput = z.infer<typeof SaveContentSchema>;
export type CreateQuizInput = z.infer<typeof CreateQuizSchema>;
export type SubmitQuizInput = z.infer<typeof SubmitQuizSchema>;
