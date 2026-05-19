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

    // Demo mode: return a helpful Vietnamese response
    return this.demoChat(messages);
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

  private demoChat(messages: ChatMessage[]): string {
    const last = messages[messages.length - 1]?.content ?? "";
    const lower = last.toLowerCase();
    if (lower.includes("xin chào") || lower.includes("hello") || lower.includes("hi")) {
      return "Xin chào! Tôi là Gia sư AI của Enterprise LMS. Tôi có thể giúp bạn giải đáp các câu hỏi học tập, giải thích khái niệm, hoặc luyện tập kiến thức. Bạn muốn học về chủ đề gì hôm nay?";
    }
    if (lower.includes("giúp") || lower.includes("help")) {
      return "Tôi có thể giúp bạn:\n• Giải thích các khái niệm khó trong bài học\n• Trả lời câu hỏi về nội dung khóa học\n• Hướng dẫn cách giải bài tập\n• Cung cấp ví dụ minh họa\n\nHãy đặt câu hỏi cụ thể để tôi hỗ trợ bạn tốt hơn nhé!";
    }
    if (lower.includes("toán") || lower.includes("math")) {
      return "Toán học là nền tảng của nhiều môn học khoa học. Để học tốt toán, bạn cần:\n1. Nắm vững các công thức cơ bản\n2. Luyện tập giải nhiều bài tập đa dạng\n3. Hiểu bản chất thay vì học thuộc lòng\n\nBạn đang gặp khó khăn ở phần nào của toán học?";
    }
    if (lower.includes("tiếng anh") || lower.includes("english")) {
      return "Để học tiếng Anh hiệu quả:\n1. **Nghe**: Nghe podcast, xem phim tiếng Anh mỗi ngày\n2. **Nói**: Luyện phát âm và nói chuyện với người bản ngữ\n3. **Đọc**: Đọc sách, báo tiếng Anh phù hợp với trình độ\n4. **Viết**: Ghi nhật ký bằng tiếng Anh\n\nBạn muốn cải thiện kỹ năng nào nhất?";
    }
    return `Câu hỏi của bạn: "${last}"\n\nĐây là chế độ demo (chưa cấu hình API key AI). Để sử dụng đầy đủ tính năng AI, hãy cấu hình OPENAI_API_KEY hoặc GEMINI_API_KEY trong file .env.\n\nTuy nhiên, tôi vẫn có thể hỗ trợ bạn với các câu hỏi cơ bản về học tập. Hãy thử hỏi về toán học, tiếng Anh, hoặc các môn học khác!`;
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
