import type { Post, FeedPost } from '@models/posts';
import { ISearchEngine } from '@adapters/secondary/searchengine/searchEngine.interface';
import db from '@adapters/secondary/db/client';
import { postsTable, feedPostsTable } from '@adapters/secondary/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

export class PostRepository {
    private db: typeof db;
    private searchEngine: ISearchEngine;

    constructor(dbClient: typeof db, searchEngineClient: ISearchEngine) {
        this.db = dbClient;
        this.searchEngine = searchEngineClient;
    }

    async getPostByOriginalUrl(originalUrl: string): Promise<Post|null> {
        const post = await this.db.select().from(postsTable).where(eq(postsTable.originalUrl, originalUrl)).limit(1).get();
        return post ? this.toDomainPost(post) : null;
    }

    async getPostByPostId(postId: number): Promise<Post|null> {
        const post = await this.db.select().from(postsTable).where(eq(postsTable.postId, postId)).limit(1).get();
        return post ? this.toDomainPost(post) : null;
    }

    async getPostsByPostIds(postIds: number[]): Promise<Post[]> {
        const posts = await this.db.select().from(postsTable).where(inArray(postsTable.postId, postIds));
        return posts.map(this.toDomainPost);
    }

    async getPostInFeed(feedId: number, postId:number): Promise<FeedPost|null> {
        const feedPost = await this.db.select().from(feedPostsTable)
        .innerJoin(postsTable, eq(feedPostsTable.postId, postsTable.postId))
        .where(and(eq(feedPostsTable.feedId, feedId), eq(feedPostsTable.postId, postId))).limit(1).get();

        if (!feedPost) {
            return null;
        }

        return this.toDomainFeedPost(feedPost.feed_posts, feedPost.posts);
    }

    async getAllPostsInFeed(feedId: number, limit: number|null = null): Promise<FeedPost[]> {
        try {
            const baseQuery = this.db.select().from(feedPostsTable)
                .innerJoin(postsTable, eq(feedPostsTable.postId, postsTable.postId))
                .where(eq(feedPostsTable.feedId, feedId)).orderBy(desc(feedPostsTable.submittedAt));
            
            // limit이 null이면 모든 게시글을 조회, 아니면 limit만큼 조회
            const feedPosts = limit === null ? await baseQuery.all() : await baseQuery.limit(limit).all();

            return feedPosts.map(feedPost => this.toDomainFeedPost(feedPost.feed_posts, feedPost.posts));
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    async createPost(
        originalUrl: string,
        textContent: string,
        htmlContent: string | null,
        title: string | null,
        generatedSummary: string | null,
        embedding: number[] | null
    ): Promise<Post> {

        const newPost = await this.db.insert(postsTable).values({
            createdAt: new Date(),
            originalUrl: originalUrl,
            textContent: textContent,
            htmlContent: htmlContent,
            title: title,
            generatedSummary: generatedSummary,
            embedding: embedding ? JSON.stringify(embedding) : null
        }).returning().get();

        return this.toDomainPost(newPost);
    }

    async createFeedToPostRelationship(feedId: number, postId:number, ownerUserId:number): Promise<void> {


        const submittedAt = new Date();
        await this.db.insert(feedPostsTable).values({
            feedId: feedId,
            postId: postId,
            ownerUserId: ownerUserId,
            submittedAt: submittedAt,
        }).catch((err) => {
            console.log(err);
            throw new Error('게시글-피드 관계 생성 실패');
        });

        const post = await this.getPostByPostId(postId);
        if (!post) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }

        const searchDocument = {
            ...post,
            feedId: feedId,
            submittedAt: submittedAt,
            ownerUserId: ownerUserId,
        }

        await this.searchEngine.indexFeedPost(searchDocument);

    }

    private toDomainPost(post: typeof postsTable.$inferSelect): Post {
        return {
            ...post,
            embedding: post.embedding ? JSON.parse(post.embedding) : null
        };
    }

    private toDomainFeedPost(feedPostRelationship: typeof feedPostsTable.$inferSelect, post: typeof postsTable.$inferSelect): FeedPost {
        return {
            ...feedPostRelationship,
            ...post,
            embedding: post.embedding ? JSON.parse(post.embedding) : null
        };
    }
}
