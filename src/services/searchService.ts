import { getSearchEngine } from '@adapters/secondary/searchengine/searchEngineFactory';
import { User } from '@models/users';
import { Feed } from '@models/feeds';
import { PostRepository } from '@repositories/postRepository';
import { UserRepository } from '@repositories/userRepository';

const searchEngine = getSearchEngine(process.env.SEARCH_ENGINE_TYPE || "meilisearch");


export async function searchPostsInFeedByKeyword(userQuery: string, feedId: number) {
    const searchResults = await searchEngine.searchFeedPostsByKeyword(userQuery, feedId);
    return searchResults;
}

export async function searchPostsInFeedByEmbedding(
    embedding: number[], 
    feedId: number,
    limit: number = 5,
    excludeIds: number[] = []
) {
    const searchResults = await searchEngine.searchFeedPostsByVector(embedding, feedId, limit, excludeIds);
    return searchResults;
}

export async function getRecommendationsForUser(user:User, feed:Feed, userRepository:UserRepository, postRepository:PostRepository, limit:number = 10, excludeIds:number[] = []) {

    const postsPromise = user.userEmbedding ? searchPostsInFeedByEmbedding(user.userEmbedding, feed.feedId, limit, excludeIds) : postRepository.getAllPostsInFeed(feed.feedId).then(posts => posts.filter(post => !excludeIds.includes(post.postId)));
    const userInteractionHistoryPromise = userRepository.getUserInteractionHistory(user.userId);

    const [posts, userInteractionHistory] = await Promise.all([postsPromise, userInteractionHistoryPromise]);

    return {
        posts: posts,
        userInteractionHistory: userInteractionHistory
    };
}

// 유저 임베딩이 없거나 모든 검색 전략이 실패할 경우 사용
export async function getFallbackRecommendations(
    feedId: number,
    limit: number = 5,
    excludeIds: number[] = []
) {

    const searchResults = await searchEngine.searchAllFeedPosts(feedId, limit, excludeIds);
    return searchResults;
}
