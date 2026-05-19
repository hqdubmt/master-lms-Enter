"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/api/client";
import type { User } from "@/shared/types";
import type { ApiResponse } from "@lms/types";
import * as XLSX from "xlsx";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Quản trị viên hệ thống",
  SCHOOL_ADMIN: "Quản trị viên trường",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  SCHOOL_ADMIN: "bg-indigo-100 text-indigo-700",
  TEACHER: "bg-blue-100 text-blue-700",
  STUDENT: "bg-green-100 text-green-700",
};

const DEFAULT_PASSWORD = "Password@123";

const VALID_ROLES = ["STUDENT", "TEACHER", "SCHOOL_ADMIN"];

async function fetchUsers(): Promise<User[]> {
  const res = await apiClient.get<ApiResponse<{ items: User[] }>>("/api/users", {
    params: { pageSize: 200 },
  });
  if (!res.data.success || !res.data.data) throw new Error("Không thể tải danh sách người dùng");
  return res.data.data.items ?? [];
}

type Modal = "none" | "create" | "bulk" | "reset";

interface BulkRow { name: string; email: string; role: string; }

function normalizeRole(raw: string | undefined): string {
  if (!raw) return "STUDENT";
  const upper = raw.trim().toUpperCase();
  if (VALID_ROLES.includes(upper)) return upper;
  // Accept Vietnamese labels
  if (upper.includes("GIÁO VIÊN") || upper === "GV" || upper === "TEACHER") return "TEACHER";
  if (upper.includes("QUẢN TRỊ") || upper === "ADMIN" || upper === "SCHOOL_ADMIN") return "SCHOOL_ADMIN";
  return "STUDENT";
}

function parseRowsFromSheetData(data: unknown[][]): BulkRow[] {
  // Skip header row if first cell looks like a header
  const rows = data.filter((r) => Array.isArray(r) && r.length >= 2);
  const start =
    rows.length > 0 &&
    String(rows[0][0] ?? "").toLowerCase().match(/name|tên|họ/) ? 1 : 0;

  return rows.slice(start).map((r) => ({
    name: String(r[0] ?? "").trim(),
    email: String(r[1] ?? "").trim(),
    role: normalizeRole(String(r[2] ?? "")),
  })).filter((r) => r.name && r.email && r.email.includes("@"));
}

function parseCSVText(text: string): BulkRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const start = lines.length > 0 && lines[0].toLowerCase().match(/name|tên|họ|email/) ? 1 : 0;
  return lines.slice(start).map((line) => {
    // Support comma or semicolon or tab separator
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    return {
      name: parts[0] ?? "",
      email: parts[1] ?? "",
      role: normalizeRole(parts[2]),
    };
  }).filter((r) => r.name && r.email && r.email.includes("@"));
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Họ và tên", "Email", "Vai trò"],
    ["Nguyễn Văn A", "vanA@truong.edu.vn", "STUDENT"],
    ["Trần Thị B", "thiB@truong.edu.vn", "TEACHER"],
    ["Lê Văn C", "vanC@truong.edu.vn", "SCHOOL_ADMIN"],
  ]);
  ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Danh sách");
  XLSX.writeFile(wb, "mau-them-tai-khoan.xlsx");
}

async function parseFile(file: File): Promise<BulkRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "txt") {
    const text = await file.text();
    return parseCSVText(text);
  }
  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    return parseRowsFromSheetData(data as unknown[][]);
  }
  throw new Error("Chỉ hỗ trợ file .csv, .xlsx, .xls, .txt");
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState<Modal>("none");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STUDENT" });
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSource, setBulkSource] = useState<"file" | "text" | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<Array<{ email: string; status: string; reason?: string }> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<User>>("/api/users/", {
        name: form.name,
        email: form.email,
        password: form.password || DEFAULT_PASSWORD,
        role: form.role,
      });
      if (!res.data.success) throw new Error(res.data.error ?? "Tạo thất bại");
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModal("none");
      setForm({ name: "", email: "", password: "", role: "STUDENT" });
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async (rows: BulkRow[]) => {
      const res = await apiClient.post<ApiResponse<Array<{ email: string; status: string; reason?: string }>>>(
        "/api/users/bulk",
        {
          users: rows.map((r) => ({
            name: r.name,
            email: r.email,
            password: DEFAULT_PASSWORD,
            role: VALID_ROLES.includes(r.role) ? r.role : "STUDENT",
          })),
        }
      );
      if (!res.data.success) throw new Error(res.data.error ?? "Thêm hàng loạt thất bại");
      return res.data.data ?? [];
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setBulkResult(data);
    },
    onError: (err: Error) => setBulkError(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiClient.patch<ApiResponse<User>>(`/api/users/${id}`, { isActive });
      if (!res.data.success) throw new Error(res.data.error ?? "Cập nhật thất bại");
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<{ defaultPassword: string }>>(`/api/users/${id}/reset-password`, {});
      if (!res.data.success) throw new Error(res.data.error ?? "Reset thất bại");
      return res.data.data;
    },
    onSuccess: () => {
      setResetDone(true);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleFile = useCallback(async (file: File) => {
    setBulkError(null);
    setBulkRows([]);
    setBulkResult(null);
    setFileName(file.name);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        setBulkError("Không tìm thấy dữ liệu hợp lệ trong file. Kiểm tra định dạng: Họ tên | Email | Vai trò");
        return;
      }
      setBulkRows(rows);
      setBulkSource("file");
    } catch (e: unknown) {
      setBulkError((e as Error).message);
    }
  }, []);

  const onTextChange = (text: string) => {
    setBulkText(text);
    setBulkSource("text");
    setBulkError(null);
    setBulkRows(parseCSVText(text));
    setFileName(null);
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.profile?.displayName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const closeModal = () => {
    setModal("none");
    setFormError(null);
    setBulkError(null);
    setBulkResult(null);
    setBulkText("");
    setBulkRows([]);
    setBulkSource(null);
    setFileName(null);
    setIsDragOver(false);
    setResetTarget(null);
    setResetDone(false);
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} người dùng trong trường</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setModal("bulk")}
            className="border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Nhập file
          </button>
          <button
            onClick={() => setModal("create")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">Tất cả vai trò</option>
          <option value="STUDENT">Học sinh</option>
          <option value="TEACHER">Giáo viên</option>
          <option value="SCHOOL_ADMIN">Quản trị viên trường</option>
          <option value="SUPER_ADMIN">Quản trị viên hệ thống</option>
        </select>
      </div>

      {/* Create single user modal */}
      {modal === "create" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Thêm người dùng mới</h2>
            {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="email@truong.edu.vn"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu <span className="text-gray-400 font-normal">(để trống → {DEFAULT_PASSWORD})</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Để trống = mật khẩu mặc định"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="STUDENT">Học sinh</option>
                  <option value="TEACHER">Giáo viên</option>
                  <option value="SCHOOL_ADMIN">Quản trị viên trường</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                Hủy
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || !form.email || createMutation.isPending}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {createMutation.isPending ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {modal === "bulk" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nhập tài khoản hàng loạt</h2>
                <p className="text-xs text-gray-500 mt-0.5">Mật khẩu mặc định: <strong>{DEFAULT_PASSWORD}</strong></p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadTemplate}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                  title="Tải file mẫu"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  File mẫu
                </button>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {bulkResult ? (
                /* Result view */
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Đã tạo {bulkResult.filter((r) => r.status === "created").length}/{bulkResult.length} tài khoản
                      </p>
                      {bulkResult.filter((r) => r.status === "skipped").length > 0 && (
                        <p className="text-xs text-gray-400">
                          {bulkResult.filter((r) => r.status === "skipped").length} bị bỏ qua (email đã tồn tại)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-gray-100">
                    {bulkResult.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between text-sm px-3 py-2 ${
                          r.status === "created" ? "bg-green-50" : "bg-yellow-50"
                        }`}
                      >
                        <span className="text-gray-700 truncate">{r.email}</span>
                        <span className={`text-xs font-medium ml-2 flex-shrink-0 ${
                          r.status === "created" ? "text-green-600" : "text-yellow-600"
                        }`}>
                          {r.status === "created" ? "Đã tạo" : `Bỏ qua: ${r.reason}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) await handleFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      isDragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await handleFile(file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {fileName ? (
                        <div>
                          <p className="text-sm font-medium text-indigo-600">{fileName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {bulkRows.length > 0 ? `${bulkRows.length} người dùng` : "Đang phân tích..."}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Kéo thả file vào đây hoặc click để chọn</p>
                          <p className="text-xs text-gray-400 mt-0.5">Hỗ trợ: .xlsx, .xls, .csv, .txt</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Template download hint */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cột A: Họ tên &nbsp;|&nbsp; Cột B: Email &nbsp;|&nbsp; Cột C: Vai trò (STUDENT / TEACHER / SCHOOL_ADMIN)</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">hoặc nhập trực tiếp</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Manual text input */}
                  <div>
                    <textarea
                      value={bulkText}
                      onChange={(e) => onTextChange(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder={"Nguyễn Văn A, vanA@truong.edu.vn, STUDENT\nTrần Thị B, thiB@truong.edu.vn, TEACHER\nLê Văn C, vanC@truong.edu.vn"}
                    />
                  </div>

                  {bulkError && (
                    <p className="text-sm text-red-600">{bulkError}</p>
                  )}

                  {/* Preview table */}
                  {bulkRows.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Xem trước — {bulkRows.length} người dùng
                      </p>
                      <div className="border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Họ tên</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Vai trò</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bulkRows.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{r.name}</td>
                                <td className="px-3 py-2 text-gray-500">{r.email}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    r.role === "TEACHER" ? "bg-blue-100 text-blue-700" :
                                    r.role === "SCHOOL_ADMIN" ? "bg-indigo-100 text-indigo-700" :
                                    "bg-green-100 text-green-700"
                                  }`}>
                                    {ROLE_LABELS[r.role] ?? r.role}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              {bulkResult ? (
                <button onClick={closeModal} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Đóng</button>
              ) : (
                <>
                  <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Hủy</button>
                  <button
                    onClick={() => bulkMutation.mutate(bulkRows)}
                    disabled={bulkRows.length === 0 || bulkMutation.isPending}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {bulkMutation.isPending ? "Đang tạo..." : `Tạo ${bulkRows.length} tài khoản`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {modal === "reset" && resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            {resetDone ? (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Đã đặt lại mật khẩu</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Mật khẩu mới của <strong>{resetTarget.profile?.displayName ?? resetTarget.email}</strong>:
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-lg font-bold text-gray-800 mb-4 select-all">
                  {DEFAULT_PASSWORD}
                </div>
                <p className="text-xs text-gray-400 mb-4">Thông báo mật khẩu này cho người dùng để đăng nhập và đổi lại.</p>
                <button onClick={closeModal} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Đóng</button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Đặt lại mật khẩu?</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Mật khẩu của <strong>{resetTarget.profile?.displayName ?? resetTarget.email}</strong> sẽ được đặt về: <strong>{DEFAULT_PASSWORD}</strong>
                </p>
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Hủy</button>
                  <button
                    onClick={() => resetPasswordMutation.mutate(resetTarget.id)}
                    disabled={resetPasswordMutation.isPending}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {resetPasswordMutation.isPending ? "Đang đặt lại..." : "Xác nhận"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Người dùng</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vai trò</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                          {(user.profile?.displayName ?? user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.profile?.displayName ?? "—"}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        {user.isActive ? "Đang hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => { setResetTarget(user); setResetDone(false); setModal("reset"); }}
                          className="text-xs font-medium text-orange-500 hover:text-orange-600 transition whitespace-nowrap"
                        >
                          Đặt lại MK
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                          disabled={toggleActiveMutation.isPending}
                          className={`text-xs font-medium transition whitespace-nowrap ${user.isActive ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}`}
                        >
                          {user.isActive ? "Khóa" : "Mở khóa"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      {search || roleFilter !== "all" ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
