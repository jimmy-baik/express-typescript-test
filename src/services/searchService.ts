import { createEmbedding } from "./contentExtractionService";
import { opensearchClient, OPENSEARCH_INDEX_NAME } from "../adapters/opensearch";
import { Post } from "../models/posts";

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


export async function searchPostsByEmbedding(embedding: number[], size: number = 5) {
    const opensearchResponse = await opensearchClient.search({
        index: OPENSEARCH_INDEX_NAME,
        body: {
            size: size,
            query: {
                knn: {
                    embedding: {
                        vector: embedding,
                        k: 50
                    }
                }
            }
        }
    });

    return filterUniqueSearchResults(opensearchResponse);

}

export async function searchPostsByEmbeddingWithPagination(
    embedding: number[], 
    page: number = 1, 
    limit: number = 5,
    excludeIds: string[] = []
) {
    const from = (page - 1) * limit;
    
    const opensearchResponse = await opensearchClient.search({
        index: OPENSEARCH_INDEX_NAME,
        body: {
            size: limit,
            from: from,
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
                    must_not: excludeIds.length > 0 ? [
                        {
                            terms: {
                                id: excludeIds
                            }
                        }
                    ] : []
                }
            }
        }
    });

    return filterUniqueSearchResults(opensearchResponse);
}

function filterUniqueSearchResults(opensearchResponse: any) : Post[] {
    const searchResults: Post[] = (opensearchResponse.body.hits?.hits || [])
      .sort((a: any, b: any) => b._score - a._score)
      .map((h: any) => ({
        id: h._source.id,
        title: h._source.title,
        summary: h._source.summary,
        content: h._source.content,
        createdBy: h._source.createdBy,
        timestamp: h._source.timestamp,
        embedding: null,
        sourceUrl: h._source.sourceUrl
    }));

    // 결과 반환 전 중복 제거
    const uniqueResults = searchResults.filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
    );

    return uniqueResults;
}