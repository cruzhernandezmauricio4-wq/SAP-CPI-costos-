import { GoogleGenAI, Type } from "@google/genai";
import { Integration, Recommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getOptimizationRecommendations(integration: Integration): Promise<Recommendation[]> {
  if (!process.env.GEMINI_API_KEY) {
    return [
      {
        title: "API Key Missing",
        description: "Configure GEMINI_API_KEY to get AI-powered recommendations.",
        impact: "Low",
        savings: "$0"
      }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze this SAP CPI Integration flow for cost optimization (FinOps).
      Integration Name: ${integration.name}
      Payload Size: ${integration.base_payload_size} KB
      Daily Volume: ${integration.daily_volume}
      Retry Strategy: ${integration.retries} retries with ${integration.failure_rate || 5}% assumed failure rate
      Steps: ${JSON.stringify(integration.config.steps)}
      
      Provide 3-4 specific recommendations to reduce message consumption and cost.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              impact: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
              savings: { type: Type.STRING }
            },
            required: ["title", "description", "impact", "savings"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return [];
  }
}
