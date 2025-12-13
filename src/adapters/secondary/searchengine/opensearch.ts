import { Client } from "@opensearch-project/opensearch";
import { ISearchEngine, FeedPostSearchResult } from "./searchEngine.interface";
import { FeedPost } from "@models/posts";


const OPENSEARCH_INDEX_NAME = "feed_posts";
const EMBEDDING_DIMENSION = 768;

export class OpensearchAdapter implements ISearchEngine {
    private client: Client;
    private indexName: string;

    constructor() {
        this.client = new Client({
            node: process.env.OPENSEARCH_URL || "http://localhost:9200",
            auth: {
                username: process.env.OPENSEARCH_ID || '',
                password: process.env.OPENSEARCH_PW || '',
            },
        });
        this.indexName = OPENSEARCH_INDEX_NAME;
    }

    async initializeIndex(): Promise<void> {
        const indexExists = await this.client.indices.exists({ index: this.indexName });
        if (indexExists.body) {
            return;
        }

        await this.client.indices.create({
            index: this.indexName,
            body: {
                mappings: {
                    properties: {
                        feedId: {
                            type: "integer"
                        },
                        postId: {
                            type: "integer"
                        },
                        createdAt: {
                            type: "date"
                        },
                        ownerUserId: {
                            type: "integer"
                        },
                        submittedAt: {
                            type: "date"
                        },
                        title: {
                            type: "text",
                            analyzer: "standard"
                        },
                        textContent: {
                            type: "text",
                            analyzer: "standard"
                        },
                        originalUrl: {
                            type: "keyword"
                        },
                        generatedSummary: {
                            type: "text",
                            analyzer: "standard"
                        },
                        embedding: {
                            type: "knn_vector",
                            dimension: EMBEDDING_DIMENSION,
                            method: {
                                name: "hnsw",
                                space_type: "cosinesimil",
                                engine: "lucene",
                            },
                        },
                    }
                },
                settings: {
                    index: {
                        number_of_shards: 1,
                        number_of_replicas: 0,
                        "knn": true,
                        "knn.algo_param.ef_search": 100
                    }
                }
            }
        });
    }

    async indexFeedPost(feedPost: FeedPost): Promise<void> {
        const searchDocument = {
            feedId: feedPost.feedId,
            postId: feedPost.postId,
            createdAt: feedPost.createdAt.toISOString(),
            ownerUserId: feedPost.ownerUserId,
            submittedAt: feedPost.submittedAt.toISOString(),
            title: feedPost.title || '',
            textContent: feedPost.textContent,
            originalUrl: feedPost.originalUrl,
            generatedSummary: feedPost.generatedSummary || '',
            embedding: feedPost.embedding || null
        };

        await this.client.index({
            index: this.indexName,
            body: searchDocument
        });
    }

    async searchFeedPostsByKeyword(query: string, feedId: number): Promise<FeedPostSearchResult[]> {
        const opensearchResponse = await this.client.search({
            index: this.indexName,
            body: {
                query: {
                    bool: {
                        must: [
                            {
                                multi_match: {
                                    query: query,
                                    fields: [
                                        'title^3', // title 에 제일 높은 가중치를 준다.
                                        'generatedSummary^2', // generatedSummary 에 두 번째로 높은 가중치를 준다.
                                        'textContent'
                                    ],
                                    operator: 'and'
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ]
                    }
                },
                _source: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
            }
        });

        return this.filterUniqueSearchResults(opensearchResponse);
    }

    async searchFeedPostsByVector(
        embedding: number[],
        feedId: number,
        limit: number,
        excludeIds: number[],
        k?: number
    ): Promise<FeedPostSearchResult[]> {
        // k 값이 제공되면 단일 전략으로 검색, 아니면 기존의 여러 전략을 시도
        if (k !== undefined) {
            return this.searchWithKnnStrategy(embedding, feedId, limit, excludeIds, k);
        }

        // 제일 좁은 범위의 연관성 검색부터 시작해서 점점 범위를 넓혀가는 검색 전략을 여러 개 선언해놓는다.
        const searchStrategies = [
            // 전략 1: k=50 으로 연관성 검색
            {
                name: 'knn_50',
                query: {
                    bool: {
                        must: [
                            {
                                knn: {
                                    embedding: {
                                        vector: embedding,
                                        k: 50
                                    }
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                }
            },
            // 전략 2: k=100 으로 연관성 검색
            {
                name: 'knn_100',
                query: {
                    bool: {
                        must: [
                            {
                                knn: {
                                    embedding: {
                                        vector: embedding,
                                        k: 100
                                    }
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                }
            },
            // 전략 3: k=200 으로 연관성 검색
            {
                name: 'knn_200',
                query: {
                    bool: {
                        must: [
                            {
                                knn: {
                                    embedding: {
                                        vector: embedding,
                                        k: 200
                                    }
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                }
            },
            // 전략 4: 최근 게시글 중 연관도 높은 것부터 검색
            {
                name: 'recent_with_relevance',
                query: {
                    bool: {
                        should: [
                            {
                                knn: {
                                    embedding: {
                                        vector: embedding,
                                        k: 20
                                    }
                                }
                            },
                            {
                                range: {
                                    submittedAt: {
                                        gte: "now-7d" // 최근 7일 이내의 게시글
                                    }
                                }
                            }
                        ],
                        minimum_should_match: 1,
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                }
            },
            // 전략 5: 아직 보지 않은 것만 제외하고 모두 검색
            {
                name: 'fallback_all',
                query: {
                    bool: {
                        must: [
                            {
                                match_all: {}
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                }
            }
        ];

        // 충분한 결과를 얻을 때까지 범위를 넓혀가며 조회한다.
        for (const strategy of searchStrategies) {
            try {
                const opensearchResponse = await this.client.search({
                    index: this.indexName,
                    body: {
                        size: limit,
                        query: strategy.query,
                        _source: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
                    }
                });

                const results = this.filterUniqueSearchResults(opensearchResponse);
                
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
        const opensearchResponse = await this.client.search({
            index: this.indexName,
            body: {
                size: limit,
                query: {
                    bool: {
                        must: [
                            {
                                match_all: {}
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                },
                _source: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
            }
        });

        return this.filterUniqueSearchResults(opensearchResponse);
    }

    /**
     * k 값이 제공된 경우 단일 KNN 전략으로 검색
     */
    private async searchWithKnnStrategy(
        embedding: number[],
        feedId: number,
        limit: number,
        excludeIds: number[],
        k: number
    ): Promise<FeedPostSearchResult[]> {
        const opensearchResponse = await this.client.search({
            index: this.indexName,
            body: {
                size: limit,
                query: {
                    bool: {
                        must: [
                            {
                                knn: {
                                    embedding: {
                                        vector: embedding,
                                        k: k
                                    }
                                }
                            }
                        ],
                        filter: [
                            {
                                term: {
                                    feedId: feedId
                                }
                            }
                        ],
                        must_not: excludeIds.length > 0 ? [
                            {
                                terms: {
                                    postId: excludeIds
                                }
                            }
                        ] : []
                    }
                },
                _source: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
            }
        });

        return this.filterUniqueSearchResults(opensearchResponse);
    }

    /**
     * OpenSearch 응답 결과에서 중복된 결과를 제거하는 helper 함수
     * @param opensearchResponse OpenSearch 응답 결과
     * @returns 검색 결과 중복 제거 후 반환
     */
    private filterUniqueSearchResults(opensearchResponse: any): FeedPostSearchResult[] {
        const searchResults: FeedPostSearchResult[] = (opensearchResponse.body.hits?.hits || [])
            .sort((a: any, b: any) => b._score - a._score)
            .map((h: any) => ({
                postId: h._source.postId,
                submittedAt: new Date(h._source.submittedAt),
                originalUrl: h._source.originalUrl,
                textContent: h._source.textContent,
                title: h._source.title,
                generatedSummary: h._source.generatedSummary,
            }));

        // 결과 반환 전 중복 제거
        const uniqueResults = searchResults.filter((post, index, self) => 
            index === self.findIndex(p => p.postId === post.postId)
        );

        return uniqueResults;
    }
}