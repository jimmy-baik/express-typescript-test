import { randomUUID } from 'node:crypto';
import { extract, ArticleData } from '@extractus/article-extractor';
import { Post } from '../models/posts';
import { FilesystemPostRepository } from '../repositories/postRepository';
import { llmClient, getEmbedding } from '../adapters/llm';
import { fetchTranscript } from 'youtube-transcript-plus';
import { TranscriptResponse } from 'youtube-transcript-plus/dist/types';
import { Innertube } from 'youtubei.js';

export async function extractArticle(url: string, createdByUsername: string): Promise<Post> {
    const article = await extract(url);
    if (!article || article.content === undefined) {
        throw new Error('글을 추출할 수 없습니다.');
    }

    return {
        id: String(randomUUID()),
        title: article.title || '',
        timestamp: new Date(),
        content: article.content || '',
        createdBy: createdByUsername,
        summary: null,
        embedding: null,
        sourceUrl: url
    };
}

export async function extractYoutubeTranscript(url: string, createdByUsername: string): Promise<Post> {
    const [transcripts, videoInfo] = await Promise.all([fetchTranscript(url), getYoutubeVideoInfo(url)]);
    const transcriptText = transcripts.map((item: TranscriptResponse) => item.text).join('\n');
    return {
      id: String(randomUUID()),
      title: videoInfo.title || '',
      timestamp: new Date(),
      content: `${videoInfo.description}\n${transcriptText}`,
      createdBy: createdByUsername,
      summary: null,
      embedding: null,
      sourceUrl: url
  };
}

export async function summarizeArticleContent(content: string): Promise<string> {
  const response = await llmClient.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `이 글에서 독자가 기억해야 할 제일 중요한 요점을 짧은 3문장으로 요약해줘: ${content}`,
  });
  if (!response.text || response.text === undefined) {
    throw new Error('요약에 실패했습니다.');
  }
  return response.text;
}


export async function createPostEmbedding(content: string): Promise<number[]> {
  return await getEmbedding(content);
}

export async function getYoutubeVideoInfo(url: string): Promise<{title: string, description: string}> {

  const video = await Innertube.create({lang:'ko'});
  const videoInfo = await video.getBasicInfo(url);
  return {
    title: videoInfo.basic_info.title || '',
    description: videoInfo.basic_info.short_description || ''
  };
}