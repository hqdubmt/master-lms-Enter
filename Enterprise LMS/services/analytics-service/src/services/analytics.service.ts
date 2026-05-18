import type { AppEvent } from "@lms/types";
import { clickhouse } from "../lib/clickhouse.js";

export interface CourseStats {
  courseId: number;
  schoolId: number;
  completionRate: number;
  avgScore: number;
  activeLearners: number;
}

export interface ActivityPoint {
  date: string;
  events: number;
  durationMs: number;
}

export interface DashboardStats {
  schoolId: number;
  totalUsers: number;
  totalCourses: number;
  totalCompletions: number;
  avgScore: number;
}

export async function trackEvent(event: AppEvent): Promise<void> {
  await clickhouse.insert({
    table: "lms_events",
    values: [
      {
        event_id: event.eventId,
        event_type: event.type,
        school_id: event.schoolId,
        user_id: "userId" in event ? event.userId : 0,
        course_id: "courseId" in event ? event.courseId : 0,
        score: "score" in event ? event.score : 0,
        max_score: "maxScore" in event ? event.maxScore : 0,
        duration_ms: "durationMs" in event ? event.durationMs : 0,
        lesson_id: "lessonId" in event ? event.lessonId : "",
        quiz_id: "quizId" in event ? event.quizId : "",
        occurred_at: new Date(event.timestamp).toISOString().replace("T", " ").replace("Z", ""),
      },
    ],
    format: "JSONEachRow",
  });
}

export async function getCourseStats(
  courseId: number,
  schoolId: number
): Promise<CourseStats> {
  const completionResult = await clickhouse.query({
    query: `
      SELECT
        countIf(event_type = 'lesson.completed') AS completions,
        count(DISTINCT user_id) AS active_learners
      FROM lms_events
      WHERE course_id = {courseId: Int32}
        AND school_id = {schoolId: Int32}
    `,
    query_params: { courseId, schoolId },
    format: "JSONEachRow",
  });

  const completionRows = await completionResult.json<{
    completions: number;
    active_learners: number;
  }>();

  const scoreResult = await clickhouse.query({
    query: `
      SELECT
        avgIf(score / max_score * 100, event_type = 'quiz.submitted' AND max_score > 0) AS avg_score
      FROM lms_events
      WHERE course_id = {courseId: Int32}
        AND school_id = {schoolId: Int32}
    `,
    query_params: { courseId, schoolId },
    format: "JSONEachRow",
  });

  const scoreRows = await scoreResult.json<{ avg_score: number }>();

  const enrolledResult = await clickhouse.query({
    query: `
      SELECT count(DISTINCT user_id) AS enrolled
      FROM lms_events
      WHERE course_id = {courseId: Int32}
        AND school_id = {schoolId: Int32}
    `,
    query_params: { courseId, schoolId },
    format: "JSONEachRow",
  });

  const enrolledRows = await enrolledResult.json<{ enrolled: number }>();

  const completions = Number(completionRows[0]?.completions ?? 0);
  const activeLearners = Number(completionRows[0]?.active_learners ?? 0);
  const enrolled = Number(enrolledRows[0]?.enrolled ?? 0);
  const avgScore = Number(scoreRows[0]?.avg_score ?? 0);

  const completionRate = enrolled > 0 ? (completions / enrolled) * 100 : 0;

  return {
    courseId,
    schoolId,
    completionRate: Math.round(completionRate * 100) / 100,
    avgScore: Math.round(avgScore * 100) / 100,
    activeLearners,
  };
}

export async function getUserActivity(
  userId: number,
  days: number
): Promise<ActivityPoint[]> {
  const result = await clickhouse.query({
    query: `
      SELECT
        toDate(occurred_at) AS date,
        count() AS events,
        sum(duration_ms) AS duration_ms
      FROM lms_events
      WHERE user_id = {userId: Int32}
        AND occurred_at >= now() - INTERVAL {days: Int32} DAY
      GROUP BY date
      ORDER BY date ASC
    `,
    query_params: { userId, days },
    format: "JSONEachRow",
  });

  const rows = await result.json<{
    date: string;
    events: number;
    duration_ms: number;
  }>();

  return rows.map((row) => ({
    date: row.date,
    events: Number(row.events),
    durationMs: Number(row.duration_ms),
  }));
}

export async function getSchoolDashboard(schoolId: number): Promise<DashboardStats> {
  const result = await clickhouse.query({
    query: `
      SELECT
        count(DISTINCT user_id) AS total_users,
        count(DISTINCT course_id) AS total_courses,
        countIf(event_type = 'lesson.completed') AS total_completions,
        avgIf(score / max_score * 100, event_type = 'quiz.submitted' AND max_score > 0) AS avg_score
      FROM lms_events
      WHERE school_id = {schoolId: Int32}
    `,
    query_params: { schoolId },
    format: "JSONEachRow",
  });

  const rows = await result.json<{
    total_users: number;
    total_courses: number;
    total_completions: number;
    avg_score: number;
  }>();

  const row = rows[0];

  return {
    schoolId,
    totalUsers: Number(row?.total_users ?? 0),
    totalCourses: Number(row?.total_courses ?? 0),
    totalCompletions: Number(row?.total_completions ?? 0),
    avgScore: Math.round(Number(row?.avg_score ?? 0) * 100) / 100,
  };
}
