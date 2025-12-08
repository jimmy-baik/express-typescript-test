import { ISearchEngine, FeedPostSearchResult } from "./searchEngine.interface";
import { MeiliSearch } from "meilisearch";
import dotenv from 'dotenv';
import { FeedPost } from "@models/posts";

dotenv.config();

const MEILISEARCH_INDEX_NAME = "feed_posts";

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
            searchDocument._vectors = [feedPost.embedding];
        }

        await index.addDocuments([searchDocument], { primaryKey: 'postId' });
    }

    async searchFeedPostsByKeyword(query: string, feedId: number): Promise<FeedPostSearchResult[]> {
        const index = this.client.index(this.indexName);

        const searchResponse = await index.search(query, {
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
        // k 값이 제공되면 단일 전략으로 검색
        if (k !== undefined) {
            return this.searchWithKnnStrategy(embedding, feedId, limit, excludeIds, k);
        }

        // 제일 좁은 범위의 연관성 검색부터 시작해서 점점 범위를 넓혀가는 검색 전략을 여러 개 선언해놓는다.
        const searchStrategies = [
            {
                name: 'knn_50',
                k: 50
            },
            {
                name: 'knn_100',
                k: 100
            },
            {
                name: 'knn_200',
                k: 200
            },
            // 그래도 결과가 충분하지 않으면 최근 게시글 중 연관도 높은 것부터 검색
            {
                name: 'recent_with_relevance',
                k: 20,
                recentDays: 7
            },
            // fallback : 아직 보지 않은 것만 제외하고 모두 검색
            {
                name: 'fallback_all',
                k: undefined
            }
        ];

        // 충분한 결과를 얻을 때까지 범위를 넓혀가며 조회한다.
        for (const strategy of searchStrategies) {
            try {
                let results: FeedPostSearchResult[];

                if (strategy.name === 'recent_with_relevance') {
                    // 최근 7일 이내의 게시글 필터링
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - (strategy.recentDays || 7));
                    const filter = `feedId = ${feedId} AND submittedAt >= "${sevenDaysAgo.toISOString()}"`;
                    
                    results = await this.searchWithVectorAndFilter(
                        embedding,
                        filter,
                        limit,
                        excludeIds,
                        strategy.k || 20
                    );
                } else if (strategy.name === 'fallback_all') {
                    // 모든 게시글 불러오기
                    results = await this.searchAllFeedPosts(feedId, limit, excludeIds);
                } else {
                    // 벡터 검색
                    results = await this.searchWithKnnStrategy(
                        embedding,
                        feedId,
                        limit,
                        excludeIds,
                        strategy.k || 50
                    );
                }

                // 충분한 조회결과가 나왔다면 결과를 반환한다.
                if (results.length >= limit || strategy.name === 'fallback_all') {
                    console.log(`Used search strategy: ${strategy.name}, found ${results.length} results`);
                    return results;
                }
                console.log(`Search strategy ${strategy.name} found ${results.length} results. moving on..`);
            } catch (error) {
                // 오류 발생시 다음 전략으로 넘어간다
                console.warn(`Search strategy ${strategy.name} failed:`, error);
                continue;
            }
        }

        // 모든 전략이 실패할 경우 빈 배열을 반환한다.
        return [];
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
     * k 값이 제공된 경우 단일 KNN 전략으로 검색을 수행하는 함수
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