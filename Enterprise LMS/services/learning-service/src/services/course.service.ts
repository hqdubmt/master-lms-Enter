import { prisma } from "@lms/database";
import { paginate, getPaginationArgs } from "@lms/utils";
import type { CreateCourseInput, UpdateCourseInput } from "../schemas/learning.schema.js";

// ─── Slug helpers ─────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(baseSlug: string, schoolId: number, excludeId?: number): Promise<string> {
  let candidate = baseSlug;
  let suffix = 1;
  while (true) {
    const existing = await prisma.course.findFirst({
      where: {
        schoolId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${baseSlug}-${suffix++}`;
  }
}

// ─── Service ──────────────────────────────────────────────

export const CourseService = {
  async list(
    schoolId: number,
    query: { page?: string; pageSize?: string; publishedOnly?: boolean }
  ) {
    const { skip, take, page, pageSize } = getPaginationArgs(query);

    const where = {
      schoolId,
      ...(query.publishedOnly ? { status: "PUBLISHED" as const } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          schoolId: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { modules: true, enrollments: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return paginate(items, total, page, pageSize);
  },

  async create(schoolId: number, data: CreateCourseInput) {
    const baseSlug = data.slug ?? slugify(data.title);
    const slug = await uniqueSlug(baseSlug, schoolId);

    return prisma.course.create({
      data: {
        schoolId,
        title: data.title,
        slug,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
      },
    });
  },

  async getById(id: number, schoolId: number) {
    const course = await prisma.course.findFirst({
      where: { id, schoolId },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });
    return course;
  },

  async update(id: number, schoolId: number, data: UpdateCourseInput) {
    // If slug is being changed, ensure uniqueness
    let slug: string | undefined;
    if (data.slug) {
      slug = await uniqueSlug(data.slug, schoolId, id);
    }

    return prisma.course.updateMany({
      where: { id, schoolId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  },

  async delete(id: number, schoolId: number) {
    // Soft delete — set status to ARCHIVED
    return prisma.course.updateMany({
      where: { id, schoolId },
      data: { status: "ARCHIVED" },
    });
  },

  async publish(id: number, schoolId: number) {
    return prisma.course.updateMany({
      where: { id, schoolId },
      data: { status: "PUBLISHED" },
    });
  },
};
