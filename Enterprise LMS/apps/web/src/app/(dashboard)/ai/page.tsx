"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/shared/api/ai.api";
import type { ChatMessage } from "@/shared/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Giải thích khái niệm đạo hàm là gì?",
  "Cách học tiếng Anh hiệu quả?",
  "Phương trình bậc 2 có bao nhiêu nghiệm?",
  "Tóm tắt lịch sử Việt Nam thời kỳ Pháp thuộc",
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.match(/^\d+\./)) {
          return <p key={i} className="ml-2">{line}</p>;
        }
        if (line.startsWith("•") || line.startsWith("-")) {
          return <p key={i} className="ml-2">{line}</p>;
        }
        if (line === "") return <br key={i} />;
        // Bold inline **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function AiTutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Xin chào! Tôi là Gia sư AI của Enterprise LMS. Tôi có thể giúp bạn giải đáp các câu hỏi học tập, giải thích khái niệm khó, hoặc luyện tập kiến thức. Bạn muốn hỏi gì hôm nay?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const history: ChatMessage[] = messages
        .slice(1)
        .map((m) => ({ role: m.role, content: m.content }));
      return aiApi.chat(userMessage, history, sessionId);
    },
    onSuccess: (data, userMessage) => {
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.reply, timestamp: new Date() },
      ]);
    },
    onError: (err: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Xin lỗi, có lỗi xảy ra: ${err.message}. Vui lòng thử lại.`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const sendMessage = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMutation.isPending) return;

    if (!text) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg, timestamp: new Date() },
      ]);
    }
    setInput("");
    chatMutation.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Cuộc trò chuyện mới bắt đầu. Tôi có thể giúp gì cho bạn?",
        timestamp: new Date(),
      },
    ]);
    setSessionId(undefined);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Gia sư AI</h1>
            <p className="text-xs text-gray-400">Hỗ trợ học tập 24/7</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                    : "bg-primary-100 text-primary-700"
                }`}
              >
                {msg.role === "assistant" ? "AI" : "B"}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownText text={msg.content} />
                ) : (
                  <p>{msg.content}</p>
                )}
                <p
                  className={`text-xs mt-1.5 ${
                    msg.role === "user" ? "text-primary-200" : "text-gray-400"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                AI
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions (only when only 1 message = initial greeting) */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <p className="text-xs text-gray-400 mb-2 px-1">Gợi ý câu hỏi:</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left text-sm px-3 py-2 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-gray-600 hover:text-indigo-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
            rows={1}
            className="flex-1 resize-none px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition max-h-32 overflow-y-auto"
            style={{ minHeight: "48px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || chatMutation.isPending}
            className="flex-shrink-0 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
        </p>
      </div>
    </div>
  );
}
