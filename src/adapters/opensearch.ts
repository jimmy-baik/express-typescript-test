import { Client } from "@opensearch-project/opensearch";
import dotenv from 'dotenv';

dotenv.config();

export const opensearchClient = new Client({
  node: "http://localhost:9200",
  auth: {
    username: process.env.OPENSEARCH_ID || '',
    password: process.env.OPENSEARCH_PW || '',
  },
});
