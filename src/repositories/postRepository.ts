import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto'
import type { Post } from '../models/posts';
import { opensearchClient, OPENSEARCH_INDEX_NAME } from '../adapters/opensearch';

export interface IPostRepository {
    getAllPosts(): Promise<Array<Post>|null>;
    getPost(postId: string): Promise<Post|null>;
    createPost(post: Post): Promise<string>;
    deletePost(postId: string): Promise<boolean>;
}


export class FilesystemPostRepository implements IPostRepository {
    private dataDirectoryPath: string;

    constructor(dataDirectoryPath: string) {
        this.dataDirectoryPath = dataDirectoryPath;
    }

    async getAllPosts(): Promise<Array<Post>|null> {
        // directory 내의 파일을 모두 불러온다

        const allFiles = await readdir(this.dataDirectoryPath);

        if (allFiles.length < 1) {
            return null;
        }

        // json 파일만 남긴다
        const jsonFiles = allFiles.filter(file => file.toLowerCase().endsWith('.json'));

        if (jsonFiles.length < 1) {
            return null;
        }
        
        // json 내용물을 읽어서 Post 데이터로 mapping한다.
        const data:Post[] = await Promise.all(
            jsonFiles.map(async (filename) => {
                const filePath = path.join(this.dataDirectoryPath, filename);
                const fileContent = await readFile(filePath, 'utf-8');
                const jsonData = JSON.parse(fileContent);
                return {
                    id: jsonData.id,
                    timestamp: new Date(jsonData.timestamp),
                    title: jsonData.title,
                    content: jsonData.content,
                    createdBy: jsonData.createdBy,
                    summary: jsonData.summary,
                    embedding: jsonData.embedding,
                    sourceUrl: jsonData.sourceUrl
                }
            })
        );

        // 오름차순 정렬해서 반환
        const sortedData = data.sort((a,b) => {return a.timestamp.getTime() - b.timestamp.getTime()});

        return sortedData;
    }

    async getPost(postId: string): Promise<Post|null> {
        try {
            const filePath = path.join(this.dataDirectoryPath, postId + '.json');
            const fileContent = await readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);
            return {
                id: jsonData.id,
                timestamp: new Date(jsonData.timestamp),
                title: jsonData.title,
                content: jsonData.content,
                createdBy: jsonData.createdBy,
                summary: jsonData.summary,
                embedding: jsonData.embedding,
                sourceUrl: jsonData.sourceUrl
            }
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    async createPost(post: Post): Promise<string> {

        const fileName = post.id + '.json';
        const filePath = path.join(this.dataDirectoryPath, fileName);
        const jsonString = JSON.stringify(post);
        await writeFile(filePath, jsonString);

        // OpenSearch 인덱스에 추가
        try {
            const opensearchPayload: any = {
                id: post.id,
                timestamp: post.timestamp instanceof Date ? post.timestamp.toISOString() : post.timestamp, // Date 타입을 ISO 문자열로 변환
                title: post.title,
                content: post.content,
                createdBy: post.createdBy,
                summary: post.summary,
                sourceUrl: post.sourceUrl
            };
            if (post.embedding && Array.isArray(post.embedding)) {
                opensearchPayload.embedding = post.embedding;
            }
            await opensearchClient.index({
                index: OPENSEARCH_INDEX_NAME,
                id: post.id,
                body: opensearchPayload
            });
        } catch (err) {
            console.log('OpenSearch 인덱스 추가 실패:', err);
        }

        return post.id;

    }

    async deletePost(postId:string): Promise<boolean> {

        const fileName = postId + '.json';
        const filePath = path.join(this.dataDirectoryPath, fileName);
        await rm(filePath);

        try {
            await opensearchClient.delete({
                index: OPENSEARCH_INDEX_NAME,
                id: postId
            });
        } catch (err) {
            console.log('OpenSearch 문서 삭제 실패:', err);
        }

        return true;
    }

}