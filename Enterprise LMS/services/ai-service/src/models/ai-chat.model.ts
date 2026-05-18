import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface IAiChat extends Document {
  userId: number;
  sessionId: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const AiChatSchema = new Schema<IAiChat>(
  {
    userId: { type: Number, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
    collection: "ai_chats",
  }
);

AiChatSchema.index({ userId: 1, sessionId: 1 });

export const AiChat: Model<IAiChat> =
  mongoose.models["AiChat"] ?? mongoose.model<IAiChat>("AiChat", AiChatSchema);
