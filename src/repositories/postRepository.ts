import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto'
import type { Post } from '../models/posts.js';




export class FilesystemPostRepository {
    private dataDirectoryPath: string;

    constructor(dataDirectoryPath: string) {
        this.dataDirectoryPath = dataDirectoryPath;
    }

    async getAllPosts(): Promise<Array<Post>|null> {
        // directory 내의 파일을 모두 불러온다
        console.log(this.dataDirectoryPath);
        const allFiles = await readdir(this.dataDirectoryPath);
        console.log(allFiles);
        if (allFiles.length < 1) {
            return null;
        }

        // json 파일만 남긴다
        const jsonFiles = allFiles.filter(file => file.toLowerCase().endsWith('.json'));
        console.log(jsonFiles);
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
                    content: jsonData.contentme
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
                content: jsonData.contentme
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

        return post.id;

    }

    async deletePost(postId:string): Promise<boolean> {

        const fileName = postId + '.json';
        const filePath = path.join(this.dataDirectoryPath, fileName);
        await rm(filePath);

        return true;
    }

}