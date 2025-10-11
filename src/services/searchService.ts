import { createEmbedding } from "./contentExtractionService";
import { opensearchClient, OPENSEARCH_INDEX_NAME } from "../adapters/opensearch";
import { Post } from "../models/posts";

export async function searchPosts(userQuery: string, queryEmbedding: number[]) {

    // BM25 + kNN vector 하이브리드 검색
    const opensearchResponse = await opensearchClient.search({
        index: OPENSEARCH_INDEX_NAME,
        body: {
            size: 5,
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