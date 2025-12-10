import { ISearchEngine, FeedPostSearchResult } from "./searchEngine.interface";
import { MeiliSearch, EnqueuedTask } from "meilisearch";
import dotenv from 'dotenv';
import { FeedPost } from "@models/posts";
import { NoopLogger } from "drizzle-orm";

dotenv.config();

const MEILISEARCH_INDEX_NAME = "feed_posts";
const EMBEDDING_DIMENSION = 768;
const DEFAULT_VECTOR_K = 200;

export class MeilisearchAdapter implements ISearchEngine {
    private client: MeiliSearch;
    private indexName: string;

    constructor() {
        this.client = new MeiliSearch({
            host: process.env.MEILISEARCH_URL || "http://localhost:7700",
            apiKey: process.env.MEILISEARCH_API_KEY || ''
        });
        this.indexName = MEILISEARCH_INDEX_NAME;
    }

    async initializeIndex(): Promise<void> {
        try {
            // index가 이미 존재하는지 확인한다. 있으면 초기화를 중단하고 바로 종료
            await this.client.getIndex(this.indexName);
            return;
        } catch (error) {
            // index가 존재하지 않으면 생성한다.
            console.log('meilisearch index가 존재하지 않는 것 같습니다. 생성합니다..');
            await this.client.createIndex(this.indexName, { primaryKey: 'postId' });
        }

        // index가 생성되었으면 설정을 진행한다.
        const index = this.client.index(this.indexName);

        // 검색 가능한 필드 지정
        await index.updateSearchableAttributes([
            'title',
            'generatedSummary',
            'textContent'
        ]);

        // 필터링 가능한 필드 지정
        await index.updateFilterableAttributes([
            'feedId',
            'postId',
            'submittedAt'
        ]);

        // 정렬 가능한 필드 지정
        await index.updateSortableAttributes([
            'submittedAt'
        ]);

        // 랭킹 규칙 지정
        await index.updateRankingRules([
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness'
        ]);

        // 검색결과로 반환될 필드 지정
        await index.updateDisplayedAttributes([
            'postId',
            'submittedAt',
            'originalUrl',
            'textContent',
            'title',
            'generatedSummary',
            'feedId'
        ]);

        await index.updateEmbedders({
            default: {
                source: "ollama", // openAi | huggingFace | ollama | rest | userProvided 중 하나여야 함
                model: "embeddinggemma",
                dimensions: EMBEDDING_DIMENSION,
                url: process.env.EMBEDDING_API_URL || 'http://localhost:11434/api/embed'
            }
        })

        console.log('meilisearch index 초기화 완료');

    }

    async indexFeedPost(feedPost: FeedPost): Promise<void> {
        const index = this.client.index(this.indexName);
        
        const searchDocument: any = {
            feedId: feedPost.feedId,
            postId: feedPost.postId,
            createdAt: feedPost.createdAt.toISOString(),
            ownerUserId: feedPost.ownerUserId,
            submittedAt: feedPost.submittedAt.toISOString(),
            title: feedPost.title || '',
            textContent: feedPost.textContent,
            originalUrl: feedPost.originalUrl,
            generatedSummary: feedPost.generatedSummary || '',
        };

        // embedding이 있으면 _vectors 필드에 추가
        if (feedPost.embedding) {
            searchDocument._vectors = {
                "default": feedPost.embedding
            };
        }

        await index.addDocuments([searchDocument]);

    }

    async searchFeedPostsByKeyword(query: string, feedId: number): Promise<FeedPostSearchResult[]> {
        const index = this.client.index(this.indexName);

        const searchResponse = await index.search(query, {
            hybrid: { // 검색시 semantic 연관성도 일부 반영하기로 한다. (embedding 생성은 meilisearch 단에서 다시 embedding provider를 호출해서 처리한다.)
                embedder: 'default',
                semanticRatio: 0.1 // semantic ratio가 0이면 keyword 결과만 반환. 1이면 무조건 vector 검색결과만 반환.
            },
            filter: `feedId = ${feedId}`,
            limit: 1000, // 임의로 최대 1000건까지 제한
            attributesToRetrieve: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary'],
            matchingStrategy: 'all' // openserch의 and 연산자와 비슷
        });

        return this.filterUniqueSearchResults(searchResponse);
    }

    async searchFeedPostsByVector(
        embedding: number[],
        feedId: number,
        limit: number,
        excludeIds: number[],
        k?: number
    ): Promise<FeedPostSearchResult[]> {


        const effectiveK = k ?? DEFAULT_VECTOR_K;
        const fetchLimit = Math.min(effectiveK, limit + excludeIds.length);

        const results = await this.searchWithKnnStrategy(
            embedding,
            feedId,
            fetchLimit,
            excludeIds,
            effectiveK
        );

        // 결과가 부족하면 전체 게시글을 검색해서 추가로 결과를 얻는다.
        if (results.length < limit) {
            const additionalResults = await this.searchAllFeedPosts(
                feedId,
                limit - results.length,
                [...excludeIds, ...results.map(result => result.postId)]
            );

            results.push(...additionalResults);
        }

        return results.slice(0, limit);
    }

    async searchAllFeedPosts(
        feedId: number,
        limit: number,
        excludeIds: number[]
    ): Promise<FeedPostSearchResult[]> {
        const index = this.client.index(this.indexName);

        // 필터 문자열 생성
        let filter = `feedId = ${feedId}`;
        if (excludeIds.length > 0) {
            // excude 조건 추가
            const excludeFilter = `postId NOT IN [${excludeIds.join(', ')}]`;
            filter = `${filter} AND ${excludeFilter}`;
        }

        const searchResponse = await index.search('', {
            filter: filter,
            limit: limit,
            attributesToRetrieve: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary'],
            sort: ['submittedAt:desc']
        });

        return this.filterUniqueSearchResults(searchResponse);
    }

    /**
     * feed id와 k 값이 제공된 경우 단일 feed 내 documents에 대한 검색을 수행하는 함수
     */
    private async searchWithKnnStrategy(
        embedding: number[],
        feedId: number,
        limit: number,
        excludeIds: number[],
        k: number
    ): Promise<FeedPostSearchResult[]> {
        const filter = `feedId = ${feedId}`;
        return this.searchWithVectorAndFilter(embedding, filter, limit, excludeIds, k);
    }

    /**
     * 벡터 검색을 수행하는 함수
     */
    private async searchWithVectorAndFilter(
        embedding: number[],
        baseFilter: string,
        limit: number,
        excludeIds: number[],
        k: number
    ): Promise<FeedPostSearchResult[]> {
        const index = this.client.index(this.indexName);

        let filter = baseFilter;
        if (excludeIds.length > 0) {
            // 제외조건이 제공된 경우 제외조건 추가
            const excludeFilter = `postId NOT IN [${excludeIds.join(', ')}]`;
            filter = `${filter} AND ${excludeFilter}`;
        }

        const searchResponse = await index.search('', {
            hybrid: {
                embedder: 'default',
                semanticRatio: 1 // semantic ratio가 1이면 무조건 vector 검색결과만 리턴함
            },
            vector: embedding,
            limit: Math.min(limit, k || limit), // k 값을 최대값으로 사용
            filter: filter,
            attributesToRetrieve: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
        });

        return this.filterUniqueSearchResults(searchResponse);
    }

    /**
     * MeiliSearch 응답 결과에서 중복된 결과를 제거하는 helper 함수
     * @param searchResponse MeiliSearch 응답 결과
     * @returns 검색 결과 중복 제거 후 반환
     */
    private filterUniqueSearchResults(searchResponse: any): FeedPostSearchResult[] {
        const searchResults: FeedPostSearchResult[] = (searchResponse.hits || [])
            .map((h: any) => ({
                postId: h.postId,
                submittedAt: new Date(h.submittedAt),
                originalUrl: h.originalUrl,
                textContent: h.textContent,
                title: h.title,
                generatedSummary: h.generatedSummary,
            }));

        // 결과 반환 전 중복 제거
        const uniqueResults = searchResults.filter((post, index, self) => 
            index === self.findIndex(p => p.postId === post.postId)
        );

        return uniqueResults;
    }
}