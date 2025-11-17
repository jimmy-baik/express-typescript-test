import type { Post, FeedPost } from '@models/posts';
import { opensearchClient, OPENSEARCH_INDEX_NAME } from '@adapters/secondary/opensearch';
import db from '@adapters/secondary/db/client';
import { postsTable, feedPostsTable } from '@adapters/secondary/db/schema';
import { eq, and } from 'drizzle-orm';
import { dateToUnixTimestamp, getUnixTimestamp, unixTimestampToDate } from '@system/timezone';

export class PostRepository {
    private db: typeof db;
    private searchEngine: typeof opensearchClient;

    constructor(dbClient: typeof db, searchEngineClient: typeof opensearchClient) {
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

    async getPostInFeed(feedId: number, postId:number): Promise<FeedPost|null> {
        const feedPost = await this.db.select().from(feedPostsTable)
        .innerJoin(postsTable, eq(feedPostsTable.postId, postsTable.postId))
        .where(and(eq(feedPostsTable.feedId, feedId), eq(feedPostsTable.postId, postId))).limit(1).get();

        if (!feedPost) {
            return null;
        }

        return this.toDomainFeedPost(feedPost.feed_posts, feedPost.posts);
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
            createdAt: getUnixTimestamp(),
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
            submittedAt: dateToUnixTimestamp(submittedAt),
        });

        const post = await this.getPostByPostId(postId);
        if (!post) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }

        const searchDocument = {
            ...post,
            feedId: feedId,
            submittedAt: dateToUnixTimestamp(submittedAt),
            ownerUserId: ownerUserId,
        }

        await this.searchEngine.index({
            index: OPENSEARCH_INDEX_NAME,
            body: searchDocument
        });
    }

    private toDomainPost(post: typeof postsTable.$inferSelect): Post {
        return {
            ...post,
            createdAt: unixTimestampToDate(post.createdAt),
            embedding: post.embedding ? JSON.parse(post.embedding) : null
        };
    }

    private toDBPost(post: Post): typeof postsTable.$inferInsert {
        return {
            ...post,
            createdAt: dateToUnixTimestamp(post.createdAt),
            embedding: post.embedding ? JSON.stringify(post.embedding) : null,
        };
    }

    private toDomainFeedPost(feedPostRelationship: typeof feedPostsTable.$inferSelect, post: typeof postsTable.$inferSelect): FeedPost {
        return {
            ...feedPostRelationship,
            ...post,
            createdAt: unixTimestampToDate(post.createdAt),
            submittedAt: unixTimestampToDate(feedPostRelationship.submittedAt),
            embedding: post.embedding ? JSON.parse(post.embedding) : null
        };
    }
}
