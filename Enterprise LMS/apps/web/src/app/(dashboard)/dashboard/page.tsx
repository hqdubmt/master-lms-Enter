"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/shared/store/auth.store";
import { learningApi } from "@/shared/api/learning.api";
import { gameApi } from "@/shared/api/game.api";
import { Card } from "@/widgets/Card";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const displayName =
    user?.profile?.displayName ?? user?.email?.split("@")[0] ?? "there";

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => learningApi.getMyEnrollments(),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => gameApi.getMyStats(),
    enabled: !!user,
  });

  const completedCount = enrollments.filter(
    (e) => e.status === "COMPLETED"
  ).length;

  const recentEnrollments = enrollments.slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">Welcome back, {displayName}!</h2>
        <p className="mt-1 text-primary-100">
          Continue your learning journey. You have{" "}
          <span className="font-semibold text-white">
            {enrollments.length - completedCount}
          </span>{" "}
          active course{enrollments.length - completedCount !== 1 ? "s" : ""}{" "}
          in progress.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/courses"
            className="px-4 py-2 bg-white text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-50 transition-colors"
          >
            Browse Courses
          </Link>
          <Link
            href="/ai"
            className="px-4 py-2 bg-primary-700 text-white text-sm font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            Ask AI Tutor
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          title="Enrolled Courses"
          value={enrollmentsLoading ? "-" : enrollments.length}
          description="Total enrollments"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <Card
          title="Completed"
          value={enrollmentsLoading ? "-" : completedCount}
          description="Courses finished"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        />
        <Card
          title="Points Earned"
          value={stats?.points ?? 0}
          description={`Level ${stats?.level ?? 1}`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        />
        <Card
          title="Global Rank"
          value={stats?.rank ? `#${stats.rank}` : "—"}
          description="On leaderboard"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Recent courses */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Courses</h3>
          <Link
            href="/courses"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {enrollmentsLoading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Loading...
            </div>
          ) : recentEnrollments.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-400 text-sm">No courses yet.</p>
              <Link
                href="/courses"
                className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Browse courses to get started
              </Link>
            </div>
          ) : (
            recentEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {enrollment.course?.title ?? `Course #${enrollment.courseId}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    Enrolled{" "}
                    {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    enrollment.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : enrollment.status === "ACTIVE"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {enrollment.status}
                </span>
                <Link
                  href={`/courses/${enrollment.courseId}`}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium ml-2"
                >
                  Continue
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "AI Tutor", href: "/ai", emoji: "🤖" },
            { label: "Join Classroom", href: "/classroom", emoji: "🎓" },
            { label: "Leaderboard", href: "/rewards", emoji: "🏆" },
            { label: "All Courses", href: "/courses", emoji: "📚" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all text-center"
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-sm font-medium text-gray-700">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
