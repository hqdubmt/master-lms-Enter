"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi } from "@/shared/api/learning.api";
import Link from "next/link";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const courseId = parseInt(id, 10);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => learningApi.getCourse(courseId),
  });

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => learningApi.getMyEnrollments(),
  });

  const isEnrolled = enrollments?.some((e) => e.courseId === courseId);

  const enrollMutation = useMutation({
    mutationFn: () => learningApi.enroll(courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!course) {
    return <div className="text-center text-gray-500 mt-20">Không tìm thấy khóa học.</div>;
  }

  const totalLessons = course.modules?.reduce(
    (acc, m) => acc + (m.lessons?.length ?? 0),
    0
  ) ?? 0;

  const statusLabel: Record<string, string> = {
    PUBLISHED: "Đã xuất bản",
    DRAFT: "Bản nháp",
    ARCHIVED: "Lưu trữ",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        {course.thumbnailUrl && (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-56 object-cover"
          />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${
                  course.status === "PUBLISHED"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {statusLabel[course.status] ?? course.status}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              {course.description && (
                <p className="mt-2 text-gray-600">{course.description}</p>
              )}
              <p className="mt-3 text-sm text-gray-500">
                {course.modules?.length ?? 0} chương · {totalLessons} bài học
              </p>
            </div>
            <div className="flex-shrink-0">
              {isEnrolled ? (
                <span className="inline-block bg-green-100 text-green-700 text-sm font-medium px-4 py-2 rounded-lg">
                  Đã đăng ký
                </span>
              ) : (
                <button
                  onClick={() => enrollMutation.mutate()}
                  disabled={enrollMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {enrollMutation.isPending ? "Đang đăng ký..." : "Đăng ký ngay"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Chương trình học</h2>
      <div className="space-y-4">
        {course.modules?.map((module) => (
          <div
            key={module.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-800">{module.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {module.lessons?.length ?? 0} bài học
              </p>
            </div>
            <ul className="divide-y divide-gray-50">
              {module.lessons?.map((lesson) => (
                <li key={lesson.id}>
                  {isEnrolled ? (
                    <Link
                      href={`/lessons/${module.id}/${lesson.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-indigo-50 transition group"
                    >
                      <span className="text-gray-400 group-hover:text-indigo-500 transition">
                        {lesson.contentType === "VIDEO" ? "▶" : lesson.contentType === "QUIZ" ? "📝" : "📄"}
                      </span>
                      <span className="text-sm text-gray-700 group-hover:text-indigo-600 transition">
                        {lesson.title}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3 opacity-50 cursor-not-allowed">
                      <span className="text-gray-400">🔒</span>
                      <span className="text-sm text-gray-600">{lesson.title}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.back()}
        className="mt-8 text-sm text-gray-500 hover:text-indigo-600 transition"
      >
        ← Quay lại khóa học
      </button>
    </div>
  );
}
