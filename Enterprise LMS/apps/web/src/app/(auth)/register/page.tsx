"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/shared/api/auth.api";
import { useAuthStore } from "@/shared/store/auth.store";

const registerSchema = z.object({
  name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Phải có ít nhất một chữ hoa")
    .regex(/[0-9]/, "Phải có ít nhất một chữ số"),
  schoolName: z.string().min(2, "Tên trường phải có ít nhất 2 ký tự"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const result = await authApi.register(data);
      setAuth(result.user, result.accessToken);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Đăng ký thất bại. Vui lòng thử lại.";
      setServerError(message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        Tạo tài khoản của bạn
      </h2>

      {serverError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Họ và tên
          </label>
          <input
            {...register("name")}
            type="text"
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder="ban@truong.edu.vn"
            autoComplete="email"
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
            placeholder="••••••••"
            autoComplete="new-password"
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
            Tên trường
          </label>
          <input
            {...register("schoolName")}
            type="text"
            placeholder="Trường THPT ABC"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {errors.schoolName && (
            <p className="mt-1 text-xs text-red-600">
              {errors.schoolName.message}
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
              Đang tạo tài khoản...
            </span>
          ) : (
            "Tạo tài khoản"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
