import { opensearchClient, OPENSEARCH_INDEX_NAME } from '@adapters/secondary/opensearch';
import { Post } from '@models/posts';

export async function searchPosts(userQuery: string, queryEmbedding: number[], size: number = 5) {

    // BM25 + kNN vector 하이브리드 검색
    const opensearchResponse = await opensearchClient.search({
        index: OPENSEARCH_INDEX_NAME,
        body: {
            size: size,
            query: {
                hybrid: {
                    queries: [
                        {
                            multi_match: {
                                query: userQuery,
                                fields: [
                                    'title^3', // title 에 제일 높은 가중치를 준다.
                                    'summary^2', // summary 에 두 번째로 높은 가중치를 준다.
                                    'content',
                                    'createdBy'
                                ],
                                operator: 'and'
                            }
                        },
                        {
                            knn: {
                                embedding: {
                                    vector: queryEmbedding,
                                    k: 50
                                }
                            }
                        }
                    ]
                }
            },
            _source: ['id', 'timestamp', 'title', 'summary', 'content', 'createdBy']
        }
    });

    return filterUniqueSearchResults(opensearchResponse);
}


export async function searchPostsInFeedByEmbedding(
    embedding: number[], 
    feedId: number,
    limit: number = 5,
    excludeIds: string[] = []
) {
    
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
            const opensearchResponse = await opensearchClient.search({
                index: OPENSEARCH_INDEX_NAME,
                body: {
                    size: limit,
                    query: strategy.query,
                    _source: ['postId', 'submittedAt', 'originalUrl', 'textContent', 'title', 'generatedSummary']
                }
            });

            const results = filterUniqueSearchResults(opensearchResponse);
            
            // 충분한 조회결과가 나왔다면 결과를 반환한다.
            if (results.length >= limit || strategy.name === 'fallback_all') {
                console.log(`Used search strategy: ${strategy.name}, found ${results.length} results`);
                return results;
            }
            console.log(`Search strategy ${strategy.name} found ${results.length} results. moving on..`);
        } catch (error) {
            console.warn(`Search strategy ${strategy.name} failed:`, error);
            // 오류 발생시 다음 전략으로 넘어간다
        }
    }

    // 모든 전략이 실패할 경우 빈 배열을 반환한다.
    return [];
}

// 유저 임베딩이 없거나 모든 검색 전략이 실패할 경우 사용
export async function getFallbackRecommendations(
    feedId: number,
    limit: number = 5,
    excludeIds: string[] = []
) {

    const opensearchResponse = await opensearchClient.search({
        index: OPENSEARCH_INDEX_NAME,
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

    return filterUniqueSearchResults(opensearchResponse);
}

function filterUniqueSearchResults(opensearchResponse: any) : Post[] {
    const searchResults: Post[] = (opensearchResponse.body.hits?.hits || [])
      .sort((a: any, b: any) => b._score - a._score)
      .map((h: any) => ({
        postId: h._source.postId,
        createdAt: h._source.createdAt,
        originalUrl: h._source.originalUrl,
        textContent: h._source.textContent,
        htmlContent: null,
        title: h._source.title,
        generatedSummary: h._source.generatedSummary,
        embedding: null
    }));

    // 결과 반환 전 중복 제거
    const uniqueResults = searchResults.filter((post, index, self) => 
        index === self.findIndex(p => p.postId === post.postId)
    );

    return uniqueResults;
}