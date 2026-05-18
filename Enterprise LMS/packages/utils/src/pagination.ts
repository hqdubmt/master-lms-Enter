import type { PaginatedResponse } from "@lms/types";

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getPaginationArgs(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? "20", 10)));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}
