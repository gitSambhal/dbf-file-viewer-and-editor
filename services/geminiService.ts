
import { GoogleGenAI } from "@google/genai";
import { DBFData } from "../types";

export const analyzeData = async (data: DBFData): Promise<string> => {
  // Initialization moved inside the function to ensure process.env.API_KEY
  // is available at runtime, satisfying SDK requirements for browser environments.
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing from process.env.API_KEY");
    return "AI analysis is unavailable: API Key not configured.";
  }

  const ai = new GoogleGenAI({ apiKey });
  const sampleRows = data.rows.slice(0, 15);
  const fields = data.header.fields.map(f => `${f.name} (${f.type}, len ${f.length})`).join(', ');

  const prompt = `
    I have a DBF file named "${data.fileName}" with ${data.rows.length} records.
    Fields: ${fields}.
    Here is a sample of the first few rows in JSON format:
    ${JSON.stringify(sampleRows, null, 2)}

    Please analyze this data and provide:
    1. A summary of what this dataset appears to be.
    2. Potential insights or patterns you notice.
    3. Suggestions for data cleaning or interesting queries I could run.
    Format your response nicely with markdown headers.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to analyze data with Gemini. " + (error instanceof Error ? error.message : "Unexpected error.");
  }
};
