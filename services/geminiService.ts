import { GoogleGenAI, Type } from "@google/genai";
import { PayoutEntry } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(file);
  });

  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const generatePayoutsFromJson = async (imageFiles: File[]): Promise<PayoutEntry[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));
  
  const prompt = `
    You are an expert OCR and data extraction tool. Analyze the provided images of a poker tournament payout table. The images represent parts of a single, continuous list and might have overlapping content.
    Your task is to combine the data from all images into one complete, ordered list. You must de-duplicate any overlapping ranks that appear across different images.
    For each entry, extract the finishing position (rank) and its corresponding prize money.
    For rank ranges like '11 ~ 12' or '16 - 20', you must expand this range and create a separate entry for each individual rank (e.g., for '16 - 20', create entries for 16, 17, 18, 19, and 20), with all of them having the same prize money.
    Ignore currency symbols (like $, €), commas, and any trailing text (like "+ Bounty") in the prize money column. Extract only the numerical value of the prize.
    Return the final, combined, and de-duplicated data in the exact JSON format specified by the provided schema. Only return the JSON data.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { parts: [
            ...imageParts,
            { text: prompt },
        ] },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              position: {
                type: Type.INTEGER,
                description: "The finishing rank as an integer.",
              },
              prize: {
                type: Type.NUMBER,
                description: "The prize money as a number, without currency symbols or commas.",
              },
            },
            required: ["position", "prize"],
          },
        },
      },
    });

    const parsedResponse = JSON.parse(response.text);
    return parsedResponse as PayoutEntry[];

  } catch (error) {
    console.error("Error generating content from Gemini:", error);
    throw new Error("Failed to process the image with Gemini API. Please check the console for details.");
  }
};