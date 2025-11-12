export interface Post {
    id: string
    feedId: string
    ownerUsername: string
    timestamp: Date // utc timestamp
    sourceUrl: string
    title: string
    textContent: string
    htmlContent: string | null
    summary: string | null
    embedding: number[] | null
}

export enum UserPostInteractionType {
    LIKE = 'LIKE',
    VIEW = 'VIEW'
}

export interface UserPostInteraction {
    id: number
    timestamp: Date // utc
    username: string
    postId: string
    interactionType: UserPostInteractionType
}