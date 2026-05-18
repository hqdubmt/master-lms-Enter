import { LlmService, type ChatMessage } from "./llm.service.js";

export interface Question {
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export class QuizGenerator {
  private llm: LlmService;

  constructor(llm: LlmService) {
    this.llm = llm;
  }

  async generateFromText(text: string, questionCount = 5): Promise<Question[]> {
    const systemPrompt = `You are an educational quiz generator. Always respond with valid JSON only — no markdown, no explanation outside JSON.`;

    const userMessage = `Generate ${questionCount} multiple-choice questions from the following content.

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one option is correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization

Content:
"""
${text}
"""

Respond with this exact JSON structure:
{
  "questions": [
    {
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why option A is correct."
    }
  ]
}

correctIndex is 0-based (0 = A, 1 = B, 2 = C, 3 = D).`;

    const messages: ChatMessage[] = [{ role: "user", content: userMessage }];

    const responseText = await this.llm.chat(messages, systemPrompt);

    try {
      // Strip any markdown code fences if present
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```\s*$/m, "")
        .trim();

      const parsed = JSON.parse(cleaned) as { questions: Question[] };

      if (!Array.isArray(parsed.questions)) {
        throw new Error("Response missing questions array");
      }

      return parsed.questions.map((q) => ({
        text: String(q.text),
        options: (q.options as string[]).slice(0, 4) as [string, string, string, string],
        correctIndex: (Number(q.correctIndex) as 0 | 1 | 2 | 3) ?? 0,
        explanation: String(q.explanation ?? ""),
      }));
    } catch (err) {
      console.error("[QuizGenerator] Failed to parse LLM response:", err, "\nRaw:", responseText);
      throw new Error(`Failed to parse quiz questions from LLM response: ${String(err)}`);
    }
  }
}
