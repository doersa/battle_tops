import { GoogleGenAI, Type } from "@google/genai";
import { AiComment } from "../types";
import { FALLBACK_AI_COMMENTS } from "../constants";

export const generateViralComment = async (score: number, outcome: 'WIN' | 'LOSS' | 'DRAW'): Promise<AiComment> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    return getFallbackComment(score, outcome);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `The user played a "Battle Tops" (Beyblade style) mini-game.
      Outcome: ${outcome}
      Final Score: ${score}
      
      Generate a funny, viral WeChat Moment style result card.
      
      Context:
      - WIN with High Score: Glorious victory, god of destruction.
      - WIN with Low Score: Lucky win, scraping by.
      - LOSS: Roasted for being weak, destroyed, or flying out of the arena.

      Output language: Chinese (witty internet slang).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "2-4 word powerful title (e.g. 战场主宰, 旋转废铁)" },
            comment: { type: Type.STRING, description: "Short, funny viral comment < 20 words." }
          },
          required: ["title", "comment"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AiComment;
    }
    throw new Error("Empty response");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return getFallbackComment(score, outcome);
  }
};

const getFallbackComment = (score: number, outcome: string): AiComment => {
  if (outcome === 'LOSS') return { title: "战损废铁", comment: "被撞得找不着北了吧？" };
  if (score < 5000) return { title: "险胜一筹", comment: "运气也是实力的一部分。" };
  return { title: "陀螺战神", comment: "全场最强，不接受反驳！" };
};