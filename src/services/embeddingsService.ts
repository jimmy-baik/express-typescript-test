import { User, UserInteractionHistory } from '@models/users';
import { PostRepository } from '@repositories/postRepository';


export async function calculateUserEmbedding(userInteractionHistory: UserInteractionHistory, postsRepository: PostRepository) : Promise<number[]|null> {

    if (userInteractionHistory.viewedPostIds.length < 1  && userInteractionHistory.likedPostIds.length < 1) {
        return null;
    }

    // 사용자가 조회한 게시물과 좋아요를 누른 게시물의 embedding을 모두 가져온다.
    const [viewedPostsEmbeddings, likedPostsEmbeddings] = await Promise.all([
        postsRepository.getPostsByPostIds(userInteractionHistory.viewedPostIds).then(posts => posts.map(post => post.embedding)), // 조회한 게시물의 embedding을 가져온다.
        postsRepository.getPostsByPostIds(userInteractionHistory.likedPostIds).then(posts => posts.map(post => post.embedding)) // 좋아요를 누른 게시물의 embedding을 가져온다.
    ]);

    const averagedViewedPostsEmbedding = averageEmbeddings(viewedPostsEmbeddings);
    const averagedLikedPostsEmbedding = averageEmbeddings(likedPostsEmbeddings);
    return combineWeightedEmbeddings(averagedViewedPostsEmbedding, averagedLikedPostsEmbedding, 0.3, 0.7);

}

function averageEmbeddings(embeddings: (number[] | null)[]) : number[] {

    if (embeddings === undefined || embeddings === null ) return [];

    const validEmbeddings = embeddings.filter(embedding => embedding !== null);
    if (validEmbeddings.length === 0) return [];

    // 원본 embeding의 dimension을 구한다.
    const embeddingDimensions = validEmbeddings[0]!.length;
    // 모든 embedding을 합친 값을 저장할 빈 array를 만든다. 길이는 원본 embedding의 dimension과 같다.
    const accumulatorArray = new Array(embeddingDimensions).fill(0);
    
    // 2d 배열의 각 row마다 accumulator array의 각 자릿수로 모든 값을 더한다
    const sum = validEmbeddings.reduce((accArray, currentEmbedding) => {
        return accArray.map((accArrayValue, accArrayIndex) => accArrayValue + currentEmbedding[accArrayIndex]);
    }, accumulatorArray);

    // 각 자릿수마다 더한 값을 배열의 길이로 나눈다.
    return sum.map(v => v / validEmbeddings.length);
}

function combineWeightedEmbeddings(embeddingA: number[], embeddingB: number[], weightA: number, weightB: number) : number[] {

    const combined = new Array(Math.max(embeddingA.length, embeddingB.length)).fill(0);
    for (let i = 0; i < combined.length; i++) {
        const valA = embeddingA[i] || 0;
        const valB = embeddingB[i] || 0;
        combined[i] = valA * weightA + valB * weightB;
    }

    const normalized = Math.sqrt(combined.reduce((sum, v) => sum + v * v, 0));
    return normalized > 0 ? combined.map(v => v / normalized) : combined;

}