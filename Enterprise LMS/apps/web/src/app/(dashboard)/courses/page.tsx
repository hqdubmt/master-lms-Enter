"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { learningApi } from "@/shared/api/learning.api";
import type { Course } from "@/shared/types";

type FilterTab = "all" | "enrolled" | "published";

function CourseCard({
  course,
  isEnrolled,
}: {
  course: Course;
  isEnrolled: boolean;
}) {
  const statusLabel: Record<string, string> = {
    PUBLISHED: "Đã xuất bản",
    DRAFT: "Bản nháp",
    ARCHIVED: "Lưu trữ",
  };

  return (
    <Link href={`/courses/${course.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-primary-200 transition-all group">
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-primary-100 to-indigo-100 relative overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-primary-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                course.status === "PUBLISHED"
                  ? "bg-green-100 text-green-700"
                  : course.status === "DRAFT"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {statusLabel[course.status] ?? course.status}
            </span>
            {isEnrolled && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                Đã đăng ký
              </span>
            )}
          </div>
        </div>
        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
            {course.title}
          </h3>
          {course.description && (
            <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
              {course.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Cập nhật {new Date(course.updatedAt).toLocaleDateString("vi-VN")}
            </span>
            <span className="text-sm font-medium text-primary-600 group-hover:text-primary-700">
              Xem khóa học →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", search, filter],
    queryFn: () =>
      learningApi.getCourses({
        search: search || undefined,
        status: filter === "published" ? "PUBLISHED" : undefined,
        enrolled: filter === "enrolled" ? true : undefined,
        pageSize: 50,
      }),
    staleTime: 30_000,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => learningApi.getMyEnrollments(),
  });

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const courses = coursesData?.items ?? [];

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "enrolled", label: "Đã đăng ký" },
    { key: "published", label: "Đã xuất bản" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Khóa học</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {coursesData?.total ?? 0} khóa học có sẵn
          </p>
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm khóa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {coursesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 h-64 animate-pulse"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-gray-400 text-sm">Không tìm thấy khóa học.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.has(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
