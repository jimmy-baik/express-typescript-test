import { randomUUID } from 'node:crypto';
import { extract, ArticleData } from '@extractus/article-extractor';
import { Post } from '../models/posts';
import { FilesystemPostRepository } from '../repositories/postRepository';
import { llmClient, getEmbedding } from '../adapters/llm';
import { fetchTranscript } from 'youtube-transcript-plus';
import { TranscriptResponse } from 'youtube-transcript-plus/dist/types';
import { Innertube } from 'youtubei.js';
import Parser from 'rss-parser';

export async function ingestContent(url:string, createdByUsername:string, postsRepository: FilesystemPostRepository) : Promise<void> {
    
  // RSS feed인 경우 feed에 등록된 전체 아티클을 처리하는 함수에 처리를 위임한 후 바로 종료한다.
  if (isRSSUrl(url)) {
    await ingestRSSFeedArticles(url, createdByUsername, postsRepository);
    return;
  }

  // Feed 가 아니라 개별 컨텐츠인 경우 컨텐츠 종류에 따라 추출 전략을 실행한다.
  let post: Post;
  const videoId = parseYoutubeVideoId(url);
  if (videoId) {
    post = await extractYoutubeTranscript(videoId, createdByUsername);
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
 * RSS feed에서 모든 아티클을 가져와서 Post로 변환하여 저장한다.
 * @param feedUrl RSS feed URL
 * @param createdByUsername 생성자 사용자명
 * @param postsRepository Post 저장소
 */
async function ingestRSSFeedArticles(
  feedUrl: string,
  createdByUsername: string,
  postsRepository: FilesystemPostRepository
): Promise<void> {

  const parser = new Parser();
  const feed = await parser.parseURL(feedUrl);

  if (!feed.items || feed.items.length === 0) {
    console.log('RSS feed에서 아티클을 찾을 수 없습니다.');
    return;
  }

  const urlObject = new URL(feedUrl);
  const rootUrl = urlObject.origin;
  console.log(`RSS feed 루트 URL: ${rootUrl}`);

  console.log(`RSS feed에서 ${feed.items.length}개의 아티클 발견. 처리를 시작합니다..`);
  for (const item of feed.items) {
    if (!item.link) {
      console.log(`RSS feed 아티클 링크 없음으로 건너뜀: ${item.title}`);
      continue;
    }

    try {
      let post: Post;
      const fullyQualifiedSourceUrl = rootUrl + item.link;
      // feed에서 가져온 메타데이터로 바로 Post 객체를 생성할 수 있다면 바로 변환한다
      if (item.title && item.pubDate && item.content) {
        console.log(`RSS feed 아티클 메타데이터로 바로 변환: ${item.title}`);
        post = {
          id: String(randomUUID()),
          title: item.title,
          timestamp: new Date(item.pubDate!),
          content: item.content,
          createdBy: createdByUsername,
          summary: null,
          embedding: null,
          sourceUrl: fullyQualifiedSourceUrl
        }
      } else {
        // 아닌 경우에는 링크에 직접 방문해 아티클을 추출한다.
        console.log(`RSS feed 아티클 링크에 직접 방문해 아티클 추출: ${item.link}`);
        post = await extractArticle(fullyQualifiedSourceUrl, createdByUsername);
      }

      // 요약과 임베딩을 병렬로 생성한다
      console.log(`RSS feed 아티클 요약과 임베딩 생성 시작: ${item.title}`);
      const [summary, embedding] = await Promise.all([
        summarizeArticleContent(post.content).catch((err) => {
          console.log(`요약 생성 실패 (${item.title}):`, err);
          return null;
        }),
        createPostEmbedding(post.content).catch((err) => {
          console.log(`임베딩 생성 실패 (${item.title}):`, err);
          return null;
        })
      ]);

      if (summary === null || embedding === null) {
        console.log(`요약 또는 임베딩 생성 실패로 건너뜀: ${item.title}`);
        continue;
      }

      // 요약과 임베딩을 포함하여 아티클 저장한다
      post.summary = summary;
      post.embedding = embedding;
      post.sourceUrl = fullyQualifiedSourceUrl;
      await postsRepository.createPost(post);
      console.log(`RSS feed 아티클 성공적으로 저장됨: ${post.title}`);
    } catch (error) {
      // 개별 아티클 실패 시에는 다음 아티클로 계속 진행
      console.error(`RSS feed 아티클 처리 실패 (${item.title || item.link}):`, error);
      continue;
    }
  }
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


export async function createPostEmbedding(content: string): Promise<number[]> {
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