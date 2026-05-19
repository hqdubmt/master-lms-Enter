"use client";

import { useQuery } from "@tanstack/react-query";
import { learningApi } from "@/shared/api/learning.api";
import { apiClient } from "@/shared/api/client";
import type { User } from "@/shared/types";
import type { ApiResponse } from "@lms/types";

async function fetchUsers(): Promise<User[]> {
  const res = await apiClient.get<ApiResponse<{ items: User[] }>>("/api/users", {
    params: { pageSize: 200 },
  });
  if (!res.data.success || !res.data.data) return [];
  return res.data.data.items ?? [];
}

export default function AdminAnalyticsPage() {
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => learningApi.getCourses(),
  });

  const courses = coursesData?.items ?? [];
  const isLoading = usersLoading || coursesLoading;

  const studentCount = users.filter((u) => u.role === "STUDENT").length;
  const teacherCount = users.filter((u) => u.role === "TEACHER").length;
  const adminCount = users.filter((u) => u.role === "SCHOOL_ADMIN").length;
  const activeCount = users.filter((u) => u.isActive).length;
  const publishedCourses = courses.filter((c) => c.status === "PUBLISHED").length;
  const draftCourses = courses.filter((c) => c.status === "DRAFT").length;

  const stats = [
    { label: "Tổng người dùng", value: users.length, color: "bg-indigo-500", icon: "👥" },
    { label: "Học sinh", value: studentCount, color: "bg-green-500", icon: "🎓" },
    { label: "Giáo viên", value: teacherCount, color: "bg-blue-500", icon: "👨‍🏫" },
    { label: "Quản trị viên", value: adminCount, color: "bg-purple-500", icon: "🛡️" },
    { label: "Tài khoản đang hoạt động", value: activeCount, color: "bg-emerald-500", icon: "✅" },
    { label: "Khóa học đã xuất bản", value: publishedCourses, color: "bg-orange-500", icon: "📚" },
  ];

  const roleDistribution = [
    { label: "Học sinh", count: studentCount, color: "bg-green-500", pct: users.length ? Math.round((studentCount / users.length) * 100) : 0 },
    { label: "Giáo viên", count: teacherCount, color: "bg-blue-500", pct: users.length ? Math.round((teacherCount / users.length) * 100) : 0 },
    { label: "Quản trị viên trường", count: adminCount, color: "bg-purple-500", pct: users.length ? Math.round((adminCount / users.length) * 100) : 0 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phân tích thống kê</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tổng quan hoạt động của trường</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`w-2 h-2 rounded-full ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Phân bổ người dùng theo vai trò</h2>
          <div className="space-y-4">
            {roleDistribution.map((role) => (
              <div key={role.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{role.label}</span>
                  <span className="font-medium text-gray-900">{role.count} ({role.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${role.color} rounded-full transition-all duration-500`}
                    style={{ width: `${role.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tài khoản bị khóa</span>
              <span className="font-medium text-red-600">{users.length - activeCount}</span>
            </div>
          </div>
        </div>

        {/* Course status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Trạng thái khóa học</h2>
          <div className="space-y-4">
            {[
              { label: "Đã xuất bản", count: publishedCourses, color: "bg-green-500", pct: courses.length ? Math.round((publishedCourses / courses.length) * 100) : 0 },
              { label: "Bản nháp", count: draftCourses, color: "bg-yellow-400", pct: courses.length ? Math.round((draftCourses / courses.length) * 100) : 0 },
              { label: "Lưu trữ", count: courses.length - publishedCourses - draftCourses, color: "bg-gray-400", pct: courses.length ? Math.round(((courses.length - publishedCourses - draftCourses) / courses.length) * 100) : 0 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.count} ({item.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng khóa học</span>
              <span className="font-medium text-gray-900">{courses.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Người dùng mới nhất</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Tên</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Vai trò</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.slice(0, 8).map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{user.profile?.displayName ?? "—"}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    user.role === "STUDENT" ? "bg-green-100 text-green-700" :
                    user.role === "TEACHER" ? "bg-blue-100 text-blue-700" :
                    "bg-purple-100 text-purple-700"
                  }`}>
                    {user.role === "STUDENT" ? "Học sinh" : user.role === "TEACHER" ? "Giáo viên" : "Quản trị viên"}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
