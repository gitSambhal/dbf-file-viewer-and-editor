
import { GoogleGenAI } from "@google/genai";
import { DBFData } from "../types";

// Fix: Initializing GoogleGenAI with the API key directly from environment variables as per SDK guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeData = async (data: DBFData): Promise<string> => {
  // Fix: Assuming the API key is pre-configured and accessible in the environment as per guidelines
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
    // Fix: Accessing .text property directly as it returns the generated string
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to analyze data with Gemini.";
  }
};
