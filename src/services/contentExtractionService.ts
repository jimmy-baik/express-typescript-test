import { randomUUID } from 'node:crypto';
import { extract, ArticleData } from '@extractus/article-extractor';
import { Post } from '../models/posts';
import { FilesystemPostRepository } from '../repositories/postRepository';


export async function extractArticleContentFromUrl(url: string, createdByUsername: string): Promise<Post> {
    const article = await extract(url);
    if (!article || article.content === undefined) {
        throw new Error('글을 추출할 수 없습니다.');
    }

    return {
        id: String(randomUUID()),
        title: article.title || '',
        timestamp: new Date(),
        content: article.content || '',
        createdBy: createdByUsername
    };
}
