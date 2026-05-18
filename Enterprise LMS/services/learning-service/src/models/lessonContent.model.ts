import { Schema, model, Document } from "mongoose";

// ─── LessonContent (rich content blocks) ─────────────────

interface ILessonBlock {
  type: "text" | "video" | "embed" | "quiz";
  content: unknown;
  order: number;
}

interface ILessonContent extends Document {
  lessonId: number;
  schoolId: number;
  blocks: ILessonBlock[];
  createdAt: Date;
  updatedAt: Date;
}

const LessonBlockSchema = new Schema<ILessonBlock>(
  {
    type: {
      type: String,
      enum: ["text", "video", "embed", "quiz"],
      required: true,
    },
    content: { type: Schema.Types.Mixed, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const LessonContentSchema = new Schema<ILessonContent>(
  {
    lessonId: { type: Number, required: true, index: true },
    schoolId: { type: Number, required: true, index: true },
    blocks: { type: [LessonBlockSchema], default: [] },
  },
  { timestamps: true }
);

LessonContentSchema.index({ lessonId: 1, schoolId: 1 }, { unique: true });

export const LessonContent = model<ILessonContent>(
  "LessonContent",
  LessonContentSchema
);

// ─── QuizContent ─────────────────────────────────────────

interface IQuizQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface IQuizContent extends Document {
  lessonId: number;
  schoolId: number;
  questions: IQuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    text: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },
    explanation: { type: String },
  },
  { _id: false }
);

const QuizContentSchema = new Schema<IQuizContent>(
  {
    lessonId: { type: Number, required: true, index: true },
    schoolId: { type: Number, required: true, index: true },
    questions: { type: [QuizQuestionSchema], default: [] },
  },
  { timestamps: true }
);

QuizContentSchema.index({ lessonId: 1, schoolId: 1 }, { unique: true });

export const QuizContent = model<IQuizContent>("QuizContent", QuizContentSchema);

// ─── UserProgress ─────────────────────────────────────────

interface IUserProgress extends Document {
  userId: number;
  lessonId: number;
  courseId: number;
  schoolId: number;
  completedAt: Date;
  quizScore?: number;
}

const UserProgressSchema = new Schema<IUserProgress>(
  {
    userId: { type: Number, required: true, index: true },
    lessonId: { type: Number, required: true, index: true },
    courseId: { type: Number, required: true, index: true },
    schoolId: { type: Number, required: true, index: true },
    completedAt: { type: Date, required: true, default: Date.now },
    quizScore: { type: Number },
  },
  { timestamps: true }
);

UserProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
UserProgressSchema.index({ userId: 1, courseId: 1 });

export const UserProgress = model<IUserProgress>(
  "UserProgress",
  UserProgressSchema
);
