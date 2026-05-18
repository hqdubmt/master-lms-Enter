import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class LlmService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    // Try OpenAI first
    if (this.openai) {
      try {
        const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

        if (systemPrompt) {
          openaiMessages.push({ role: "system", content: systemPrompt });
        }

        for (const msg of messages) {
          openaiMessages.push({ role: msg.role as "user" | "assistant" | "system", content: msg.content });
        }

        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 2048,
        });

        return completion.choices[0]?.message?.content ?? "";
      } catch (err) {
        console.error("[LlmService] OpenAI error, falling back to Gemini:", err);
      }
    }

    // Fallback: Gemini
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

        const parts: string[] = [];
        if (systemPrompt) {
          parts.push(`System: ${systemPrompt}\n`);
        }
        for (const msg of messages) {
          parts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`);
        }

        const prompt = parts.join("\n");
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        console.error("[LlmService] Gemini error:", err);
        throw new Error("All LLM providers failed");
      }
    }

    throw new Error("No LLM provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
  }

  async embed(text: string): Promise<number[]> {
    // Try OpenAI embeddings
    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
        return response.data[0]?.embedding ?? this.hashEmbed(text);
      } catch (err) {
        console.error("[LlmService] OpenAI embed error, using fallback:", err);
      }
    }

    // Fallback: deterministic hash-based 1536-dim vector
    return this.hashEmbed(text);
  }

  private hashEmbed(text: string): number[] {
    const dim = 1536;
    const vector = new Array<number>(dim).fill(0);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (charCode * 31 + i * 17) % dim;
      vector[idx] = (vector[idx] + charCode / 128) % 2 - 1;
    }

    // L2-normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      return vector.map((v) => v / magnitude);
    }
    return vector;
  }
}
