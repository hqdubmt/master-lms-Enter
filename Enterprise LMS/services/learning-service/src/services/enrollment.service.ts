import { prisma } from "@lms/database";
import { UserProgress } from "../models/lessonContent.model.js";

export const EnrollmentService = {
  async enroll(userId: number, courseId: number, schoolId: number) {
    // Verify course belongs to school and is published
    const course = await prisma.course.findFirst({
      where: { id: courseId, schoolId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!course) {
      throw new Error("Course not found or not available for enrollment");
    }

    // Upsert to handle duplicate enrollment attempts gracefully
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existing) {
      if (existing.status === "DROPPED") {
        // Re-activate
        return prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", completedAt: null },
        });
      }
      return existing;
    }

    return prisma.enrollment.create({
      data: { userId, courseId, status: "ACTIVE" },
    });
  },

  async getMyEnrollments(userId: number, schoolId: number) {
    return prisma.enrollment.findMany({
      where: {
        userId,
        course: { schoolId },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnailUrl: true,
            status: true,
            _count: { select: { modules: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });
  },

  async getProgress(userId: number, courseId: number) {
    // Count total lessons in course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: { select: { id: true } },
          },
        },
      },
    });

    if (!course) return null;

    const allLessonIds = course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );
    const totalLessons = allLessonIds.length;

    // Count completed lessons from MongoDB
    const completedCount = await UserProgress.countDocuments({
      userId,
      courseId,
      lessonId: { $in: allLessonIds },
    });

    const completedLessons = await UserProgress.find({
      userId,
      courseId,
    }).select("lessonId completedAt quizScore -_id").lean();

    return {
      courseId,
      userId,
      totalLessons,
      completedLessons: completedCount,
      percentage:
        totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 100)
          : 0,
      lessons: completedLessons,
    };
  },
};
