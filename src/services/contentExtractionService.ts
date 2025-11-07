import { randomUUID } from 'node:crypto';
import { extract, ArticleData } from '@extractus/article-extractor';
import { Post } from '../models/posts';
import { FilesystemPostRepository } from '../repositories/postRepository';
import { llmClient, getEmbedding } from '../adapters/llm';
import { fetchTranscript } from 'youtube-transcript-plus';
import { TranscriptResponse } from 'youtube-transcript-plus/dist/types';
import { Innertube } from 'youtubei.js';
import RSSParser from 'rss-parser';

export async function ingestContent(url:string, createdByUsername:string, postsRepository: FilesystemPostRepository) : Promise<void> {
    
  // 컨텐츠 추출작업 수행
    let post: Post;
    const videoId = parseYoutubeVideoId(url);
    if (videoId) {
      post = await extractYoutubeTranscript(videoId, createdByUsername);
    } else if (isRSSUrl(url)) {
      // TODO: RSS 피드를 추출한다.
    } else {
      post = await extractArticle(url, createdByUsername);
    }

    // 요약과 임베딩을 병렬로 생성한다
    const [summary, embedding] = await Promise.all([
        summarizeArticleContent(post.content).catch((err) => {
            console.log(err);
            return null;
        }),
        createPostEmbedding(post.content).catch((err) => {
            console.log(err);
            return null;
        })
    ]);

    if (summary === null || embedding === null) {
        throw new Error('요약과 임베딩 생성에 실패했습니다.');
    }

    // 요약을 포함하여 게시글을 저장한다
    post.summary = summary;
    post.embedding = embedding;
    post.sourceUrl = url;
    await postsRepository.createPost(post);
}

/**
 * 사용자가 제출한 url이 유튜브 url인지 확인한다.
 * @param url 사용자가 제출한 url
 * @returns 유튜브 주소인지 여부
 */
function parseYoutubeVideoId(url: string): string|null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/((?:\d|[a-z]|[A-Z])+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || null; // pattern 매치가 있을 경우 배열 0번이 youtube.com/watch ... , 1번이 video id 이다.
    }
  }
  return null;
}

function isRSSUrl(url: string): boolean {
  const rssPatterns = [
    /\.xml$/i,
    /\/feed\/?$/i,
    /\/rss\/?$/i,
    /\/atom\/?$/i,
    /feed\.xml$/i,
    /rss\.xml$/i,
    /atom\.xml$/i
  ];

  for (const pattern of rssPatterns) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

async function extractArticle(url: string, createdByUsername: string): Promise<Post> {
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

async function extractYoutubeTranscript(videoId: string, createdByUsername: string): Promise<Post> {
    const [transcripts, videoInfo] = await Promise.all([fetchTranscript(videoId), getYoutubeVideoInfo(videoId)]);
    const transcriptText = transcripts.map((item: TranscriptResponse) => item.text).join('\n');
    return {
      id: String(randomUUID()),
      title: videoInfo.title || '',
      timestamp: new Date(),
      content: `${videoInfo.description}\n${transcriptText}`,
      createdBy: createdByUsername,
      summary: null,
      embedding: null,
      sourceUrl: videoId
  };
}

async function summarizeArticleContent(content: string): Promise<string> {
  const response = await llmClient.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `이 글에서 독자가 기억해야 할 제일 중요한 요점을 짧은 3문장으로 요약해줘: ${content}`,
  });
  if (!response.text || response.text === undefined) {
    throw new Error('요약에 실패했습니다.');
  }
  return response.text;
}


async function createPostEmbedding(content: string): Promise<number[]> {
  return await getEmbedding(content);
}

async function getYoutubeVideoInfo(videoId: string): Promise<{title: string, description: string}> {

  const video = await Innertube.create({lang:'ko'});
  const videoInfo = await video.getBasicInfo(videoId);
  return {
    title: videoInfo.basic_info.title || '',
    description: videoInfo.basic_info.short_description || ''
  };
}