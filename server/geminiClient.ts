import { GoogleGenAI } from "@google/genai";

let geminiInstance: GoogleGenAI | null = null;

/**
 * Retorna ou inicializa o cliente oficial do Google Gemini API.
 * A chave de API reside exclusivamente em process.env.GEMINI_API_KEY.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }

  if (!geminiInstance) {
    geminiInstance = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return geminiInstance;
}
