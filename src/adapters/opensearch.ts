import { Client } from "@opensearch-project/opensearch";
import dotenv from 'dotenv';

dotenv.config();

const OPENSEARCH_INDEX_NAME = "posts";

export const opensearchClient = new Client({
  node: "http://localhost:9200",
  auth: {
    username: process.env.OPENSEARCH_ID || '',
    password: process.env.OPENSEARCH_PW || '',
  },
});

export async function initializeOpenSearch() {
  const indexExists = await opensearchClient.indices.exists({ index: OPENSEARCH_INDEX_NAME });
  if (indexExists.body) {
    return;
  }

  await opensearchClient.indices.create({
    index: OPENSEARCH_INDEX_NAME,
    body: {
      mappings: {
        properties: {
          id: {
            type: "keyword"
          },
          timestamp: {
            type: "date"
          },
          title: {
            type: "text",
            analyzer: "standard"
          },
          content: {
            type: "text",
            analyzer: "standard"
          },
          createdBy: {
            type: "keyword"
          },
          summary: {
            type: "text",
            analyzer: "standard"
          },
          embedding: {
            type: "knn_vector",
            dimension: 1024,
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