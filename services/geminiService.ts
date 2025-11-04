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
  // IMPORTANT: Replace "INSERT_YOUR_API_KEY_HERE" with your actual Gemini API key.
  const ai = new GoogleGenAI({ apiKey: "INSERT_YOUR_API_KEY_HERE" });

  const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));
  
  const prompt = `
    You are an expert OCR and data extraction tool. Analyze the provided images of a poker tournament payout table. The images represent parts of a single, continuous list and might have overlapping content.
    Your task is to combine the data from all images into one complete, ordered list. You must de-duplicate any overlapping ranks that appear across different images.
    For each entry, extract the finishing position (rank) and its corresponding prize money from the right-most column containing monetary values.
    For rank ranges like '11 ~ 12' or '16 - 20', you must expand this range and create a separate entry for each individual rank (e.g., for '16 - 20', create entries for 16, 17, 18, 19, and 20), with all of them having the same prize money.
    Crucially, for the prize money: if the text contains a '+' sign (e.g., '$939.99 + $1,813.75'), you MUST extract only the numerical value that appears BEFORE the '+' sign. In the given example, you would extract 939.99.
    If there is no '+' sign, extract the entire numerical value.
    In all cases, ignore currency symbols (like $, €), commas, and any trailing text (like "+ Bounty").
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
