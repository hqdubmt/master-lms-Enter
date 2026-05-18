"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi } from "@/shared/api/learning.api";
import type { QuizQuestion } from "@/shared/types";

export default function LessonPage() {
  const { moduleId, lessonId } = useParams<{ moduleId: string; lessonId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const mid = parseInt(moduleId, 10);
  const lid = parseInt(lessonId, 10);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", mid, lid],
    queryFn: () => learningApi.getLesson(mid, lid),
  });

  const completeMutation = useMutation({
    mutationFn: () => learningApi.completeLesson(mid, lid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson", mid, lid] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!lesson) {
    return <div className="text-center text-gray-500 mt-20">Lesson not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-indigo-600 transition mb-6 block"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
      <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
        {lesson.contentType}
      </span>

      <div className="mt-6">
        {lesson.contentType === "TEXT" && <TextContent lesson={lesson} />}
        {lesson.contentType === "VIDEO" && <VideoContent lesson={lesson} />}
        {lesson.contentType === "QUIZ" && <QuizContent moduleId={mid} lessonId={lid} />}
        {lesson.contentType === "INTERACTIVE" && <TextContent lesson={lesson} />}
      </div>

      {lesson.contentType !== "QUIZ" && (
        <div className="mt-8">
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending || completeMutation.isSuccess}
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {completeMutation.isSuccess
              ? "✓ Completed"
              : completeMutation.isPending
              ? "Saving..."
              : "Mark as Complete"}
          </button>
        </div>
      )}
    </div>
  );
}

function TextContent({ lesson }: { lesson: { content?: { blocks: { type: string; content: unknown; order: number }[] } } }) {
  const blocks = lesson.content?.blocks ?? [];
  if (blocks.length === 0) {
    return <p className="text-gray-500 italic">No content yet.</p>;
  }
  return (
    <div className="prose prose-indigo max-w-none">
      {blocks
        .sort((a, b) => a.order - b.order)
        .map((block, i) => (
          <div key={i} className="mb-4">
            {typeof block.content === "string" ? (
              <p className="text-gray-700 leading-relaxed">{block.content}</p>
            ) : (
              <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-auto">
                {JSON.stringify(block.content, null, 2)}
              </pre>
            )}
          </div>
        ))}
    </div>
  );
}

function VideoContent({ lesson }: { lesson: { content?: { blocks: { type: string; content: unknown }[] } } }) {
  const videoBlock = lesson.content?.blocks?.find((b) => b.type === "video");
  const src = typeof videoBlock?.content === "string" ? videoBlock.content : null;

  if (!src) {
    return <p className="text-gray-500 italic">Video not available yet.</p>;
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black aspect-video">
      <video controls className="w-full h-full" src={src}>
        <source src={src} type="application/x-mpegURL" />
        Your browser does not support HLS video.
      </video>
    </div>
  );
}

function QuizContent({ moduleId, lessonId }: { moduleId: number; lessonId: number }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    percentage: number;
    answers: { questionIndex: number; correct: boolean }[];
  } | null>(null);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", moduleId, lessonId],
    queryFn: () => learningApi.getQuiz(moduleId, lessonId),
  });

  const submitMutation = useMutation({
    mutationFn: (answerArr: number[]) =>
      learningApi.submitQuiz(moduleId, lessonId, answerArr),
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["lesson", moduleId, lessonId] });
    },
  });

  if (isLoading) {
    return <div className="text-gray-500">Loading quiz...</div>;
  }

  if (!quiz?.questions?.length) {
    return <p className="text-gray-500 italic">No quiz questions available.</p>;
  }

  const handleSubmit = () => {
    const answerArr = quiz.questions.map((_: QuizQuestion, i: number) => answers[i] ?? -1);
    submitMutation.mutate(answerArr);
  };

  if (submitted && result) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Quiz Result</h2>
        <div
          className={`text-4xl font-bold mb-4 ${
            result.percentage >= 80 ? "text-green-600" : "text-red-500"
          }`}
        >
          {result.percentage}%
        </div>
        <p className="text-gray-600 mb-6">
          {result.score} / {result.maxScore} correct
        </p>
        <div className="space-y-3">
          {quiz.questions.map((q: QuizQuestion, i: number) => {
            const ans = result.answers.find((a) => a.questionIndex === i);
            return (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  ans?.correct
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <p className="font-medium text-gray-800">{q.text}</p>
                <p className="text-sm mt-1 text-gray-600">
                  Your answer: <strong>{q.options[answers[i]] ?? "None"}</strong>
                  {!ans?.correct && (
                    <span className="ml-2 text-green-700">
                      ✓ {q.options[/* correctIndex hidden */ 0]}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {quiz.questions.map((q: QuizQuestion, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-medium text-gray-900 mb-4">
            {i + 1}. {q.text}
          </p>
          <div className="space-y-2">
            {q.options.map((opt: string, j: number) => (
              <label
                key={j}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                  answers[i] === j
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${i}`}
                  value={j}
                  checked={answers[i] === j}
                  onChange={() => setAnswers((prev) => ({ ...prev, [i]: j }))}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={
          submitMutation.isPending ||
          Object.keys(answers).length < quiz.questions.length
        }
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition disabled:opacity-50"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Quiz"}
      </button>
    </div>
  );
}
