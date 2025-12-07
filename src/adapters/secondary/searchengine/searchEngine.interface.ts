import { FeedPost } from "@models/posts";


/**
 * 검색 엔진 인터페이스
 */
export interface ISearchEngine {

    initializeIndex(): Promise<void>;

    indexFeedPost(feedPost: FeedPost): Promise<void>;

    searchFeedPostsByKeyword(query: string, feedId: number): Promise<FeedPostSearchResult[]>;

    searchFeedPostsByVector(
      embedding: number[],
      feedId: number,
      limit: number,
      excludeIds: number[],
      k?: number  // knn 검색 시 사용할 k 값
    ): Promise<FeedPostSearchResult[]>;

    searchAllFeedPosts(
      feedId: number,
      limit: number,
      excludeIds: number[]
    ): Promise<FeedPostSearchResult[]>;

}


/**
 * FeedPost 검색 결과 모델. FeedPost 검색 결과를 반환할 때 사용한다. FeedPost의 일부 속성만 담고 있다.
 */
export interface FeedPostSearchResult {
    postId: number;
    submittedAt: Date;
    originalUrl: string;
    textContent: string;
    title: string;
    generatedSummary: string;
}