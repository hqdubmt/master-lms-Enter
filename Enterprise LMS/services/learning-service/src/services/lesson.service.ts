import { prisma } from "@lms/database";
import {
  LessonContent,
  QuizContent,
  UserProgress,
} from "../models/lessonContent.model.js";
import type { ContentBlockInput, CreateQuizInput } from "../schemas/learning.schema.js";

export const LessonService = {
  // ─── Content ───────────────────────────────────────────

  async getContent(lessonId: number, schoolId: number) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { schoolId: true } },
          },
        },
      },
    });

    if (!lesson || lesson.module.course.schoolId !== schoolId) {
      return null;
    }

    const content = await LessonContent.findOne({ lessonId, schoolId }).lean();

    return { lesson, content };
  },

  async saveContent(
    lessonId: number,
    schoolId: number,
    blocks: ContentBlockInput[]
  ) {
    // Verify lesson belongs to school
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: { select: { schoolId: true } } } },
      },
    });
    if (!lesson || lesson.module.course.schoolId !== schoolId) {
      return null;
    }

    const doc = await LessonContent.findOneAndUpdate(
      { lessonId, schoolId },
      { $set: { blocks } },
      { upsert: true, new: true }
    );

    return doc;
  },

  // ─── Progress ──────────────────────────────────────────

  async markComplete(
    userId: number,
    lessonId: number,
    courseId: number,
    schoolId: number
  ) {
    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new Error("Not enrolled in this course");
    }

    const progress = await UserProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        $set: {
          userId,
          lessonId,
          courseId,
          schoolId,
          completedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Check if course is now fully completed
    await LessonService.checkCourseCompletion(userId, courseId);

    return progress;
  },

  async checkCourseCompletion(userId: number, courseId: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: { lessons: { select: { id: true } } },
        },
      },
    });
    if (!course) return;

    const allLessonIds = course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );
    if (allLessonIds.length === 0) return;

    const completedCount = await UserProgress.countDocuments({
      userId,
      courseId,
      lessonId: { $in: allLessonIds },
    });

    if (completedCount >= allLessonIds.length) {
      await prisma.enrollment.updateMany({
        where: { userId, courseId, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
  },

  // ─── Quiz ──────────────────────────────────────────────

  async saveQuiz(lessonId: number, schoolId: number, data: CreateQuizInput) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: { select: { schoolId: true } } } },
      },
    });
    if (!lesson || lesson.module.course.schoolId !== schoolId) {
      return null;
    }

    return QuizContent.findOneAndUpdate(
      { lessonId, schoolId },
      { $set: { questions: data.questions } },
      { upsert: true, new: true }
    );
  },

  async getQuiz(lessonId: number, schoolId: number, includeAnswers = false) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: { select: { schoolId: true } } } },
      },
    });
    if (!lesson || lesson.module.course.schoolId !== schoolId) {
      return null;
    }

    const quiz = await QuizContent.findOne({ lessonId, schoolId }).lean();
    if (!quiz) return null;

    if (!includeAnswers) {
      // Strip correctIndex and explanation for students
      return {
        ...quiz,
        questions: quiz.questions.map(({ text, options }) => ({
          text,
          options,
        })),
      };
    }

    return quiz;
  },

  async submitQuiz(userId: number, lessonId: number, answers: number[]) {
    const quiz = await QuizContent.findOne({ lessonId }).lean();
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    const questions = quiz.questions;
    if (answers.length !== questions.length) {
      throw new Error(
        `Expected ${questions.length} answers, got ${answers.length}`
      );
    }

    let correct = 0;
    const results = questions.map((q, i) => {
      const isCorrect = answers[i] === q.correctIndex;
      if (isCorrect) correct++;
      return {
        questionIndex: i,
        yourAnswer: answers[i],
        correctAnswer: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correct / questions.length) * 100);

    // Save quiz score to progress
    await UserProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        $set: {
          completedAt: new Date(),
          quizScore: score,
        },
      },
      { upsert: true }
    );

    return {
      score,
      correct,
      total: questions.length,
      passed: score >= 70,
      results,
    };
  },
};
