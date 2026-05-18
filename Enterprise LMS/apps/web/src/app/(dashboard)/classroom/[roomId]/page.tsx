"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/shared/store/auth.store";

interface ChatMessage {
  userId: number;
  displayName: string;
  text: string;
  timestamp: string;
}

interface ConnectedUser {
  userId: number;
  displayName: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
}

type WsEvent =
  | { type: "user-joined"; userId: number; displayName: string }
  | { type: "user-left"; userId: number }
  | { type: "message"; userId: number; displayName: string; text: string; timestamp: string }
  | { type: "quiz:question"; question: QuizQuestion }
  | { type: "quiz:result"; questionId: string; correctAnswer: number; stats: number[] }
  | { type: "hand-raised"; userId: number; displayName: string }
  | { type: "error"; message: string };

export default function ClassroomRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, accessToken } = useAuthStore();

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion | null>(null);
  const [quizResult, setQuizResult] = useState<{ correctAnswer: number; stats: number[] } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [handsRaised, setHandsRaised] = useState<string[]>([]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !user) return;

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3008").replace(/\/$/, "");
    const ws = new WebSocket(`${wsUrl}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId, token: accessToken }));
    };

    ws.onmessage = (e) => {
      const event: WsEvent = JSON.parse(e.data);
      switch (event.type) {
        case "user-joined":
          setConnected(true);
          setUsers((prev) => {
            if (prev.some((u) => u.userId === event.userId)) return prev;
            return [...prev, { userId: event.userId, displayName: event.displayName }];
          });
          break;
        case "user-left":
          setUsers((prev) => prev.filter((u) => u.userId !== event.userId));
          break;
        case "message":
          setMessages((prev) => [
            ...prev,
            {
              userId: event.userId,
              displayName: event.displayName,
              text: event.text,
              timestamp: event.timestamp,
            },
          ]);
          break;
        case "quiz:question":
          setActiveQuiz(event.question);
          setQuizResult(null);
          setSelectedAnswer(null);
          break;
        case "quiz:result":
          setQuizResult({ correctAnswer: event.correctAnswer, stats: event.stats });
          break;
        case "hand-raised":
          setHandsRaised((prev) => [...prev.slice(-4), event.displayName]);
          setTimeout(() => setHandsRaised((prev) => prev.filter((n) => n !== event.displayName)), 5000);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.send(JSON.stringify({ type: "leave", roomId }));
      ws.close();
    };
  }, [accessToken, user, roomId]);

  const sendMessage = () => {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    send({ type: "message", roomId, text });
    if (inputRef.current) inputRef.current.value = "";
  };

  const submitAnswer = (answer: number) => {
    if (selectedAnswer !== null || !activeQuiz) return;
    setSelectedAnswer(answer);
    send({ type: "quiz:answer", roomId, questionId: activeQuiz.id, answer });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Main area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h1 className="font-semibold text-gray-900">Room: {roomId}</h1>
            <p className="text-xs text-gray-500">{users.length} participants</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-xs text-gray-500">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

        {/* Quiz overlay */}
        {activeQuiz && (
          <div className="bg-indigo-50 border-b border-indigo-200 p-5">
            <p className="font-semibold text-indigo-800 mb-3">📝 {activeQuiz.text}</p>
            <div className="grid grid-cols-2 gap-2">
              {activeQuiz.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = quizResult && quizResult.correctAnswer === i;
                const isWrong = quizResult && isSelected && !isCorrect;
                return (
                  <button
                    key={i}
                    onClick={() => submitAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className={`text-sm px-4 py-2 rounded-lg border font-medium transition ${
                      isCorrect
                        ? "bg-green-100 border-green-400 text-green-800"
                        : isWrong
                        ? "bg-red-100 border-red-400 text-red-800"
                        : isSelected
                        ? "bg-indigo-200 border-indigo-400 text-indigo-800"
                        : "bg-white border-gray-200 hover:border-indigo-400"
                    }`}
                  >
                    {opt}
                    {quizResult && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({quizResult.stats[i] ?? 0})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hands raised toast */}
        {handsRaised.length > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-5 py-2 text-sm text-yellow-800">
            ✋ {handsRaised.join(", ")} raised their hand
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 mt-8 text-sm">No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.userId === user?.id ? "flex-row-reverse" : ""}`}
            >
              <div className="h-7 w-7 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                {msg.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div
                className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                  msg.userId === user?.id
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-gray-100 text-gray-800 rounded-tl-none"
                }`}
              >
                {msg.userId !== user?.id && (
                  <p className="font-medium text-indigo-500 text-xs mb-0.5">{msg.displayName}</p>
                )}
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-4 flex gap-2">
          <button
            onClick={() => send({ type: "raise-hand", roomId })}
            className="px-3 py-2 text-lg rounded-lg border border-gray-200 hover:bg-yellow-50 transition"
            title="Raise hand"
          >
            ✋
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </div>

      {/* Sidebar: participants */}
      <div className="w-56 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <h2 className="font-semibold text-gray-800 text-sm mb-3">Participants</h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                {u.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="text-sm text-gray-700 truncate">{u.displayName}</span>
              {u.userId === user?.id && (
                <span className="text-xs text-gray-400">(you)</span>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-xs text-gray-400">Waiting for others...</p>
          )}
        </div>
      </div>
    </div>
  );
}
