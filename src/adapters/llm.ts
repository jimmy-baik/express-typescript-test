import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || null;
const LLMAPIKey = process.env.GEMINI_API_KEY || null;
if (LLMAPIKey === null) {
    throw new Error('LLM API KEY가 설정되지 않았습니다. 환경변수에서 API Key를 설정해주세요.');
}


export const llmClient = new GoogleGenAI({apiKey: LLMAPIKey});


export async function getEmbedding(text: string): Promise<number[]> {
    if (!EMBEDDING_API_URL) {
        throw new Error('EMBEDDING API URL이 설정되지 않았습니다. 환경변수에서 API URL을 설정해주세요.');
    }
    const response = await fetch(EMBEDDING_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        model: "embeddinggemma",
        prompt: text,
      }),
    });
    const data = await response.json() as { embedding: number[] };
    return data.embedding; // embedding is an array of floats
}
