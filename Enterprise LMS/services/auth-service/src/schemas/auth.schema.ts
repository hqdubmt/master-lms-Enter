import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  schoolName: z.string().min(1, "School name is required").max(255),
  domain: z.string().max(255).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  schoolId: z.number().int().positive("School ID must be a positive integer"),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
  phone: z.string().max(30).optional(),
  bio: z.string().max(1000).optional(),
  role: z
    .enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"])
    .optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
