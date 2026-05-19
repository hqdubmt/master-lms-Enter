"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/shared/api/auth.api";
import { useAuthStore } from "@/shared/store/auth.store";

const loginSchema = z.object({
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  schoolId: z.coerce.number().int().positive("Mã trường học phải là số dương"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", schoolId: 1 },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const result = await authApi.login(data);
      setAuth(result.user, result.accessToken);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Đăng nhập thất bại. Vui lòng thử lại.";
      setServerError(message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        Đăng nhập vào tài khoản của bạn
      </h2>

      {serverError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="ban@truong.edu.vn"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu
          </label>
          <input
            {...register("password")}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mã trường học
          </label>
          <input
            {...register("schoolId")}
            type="number"
            min={1}
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {errors.schoolId && (
            <p className="mt-1 text-xs text-red-600">
              {errors.schoolId.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Đang đăng nhập...
            </span>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Tạo tài khoản
        </Link>
      </p>
    </div>
  );
}
