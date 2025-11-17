export interface User {
    userId: number
    username: string
    hashedPassword: string
    fullname: string | null
    createdAt: Date
    userEmbedding: number[] | null
}

export interface UserInteractionHistory {
    likedPostIds: number[]
    viewedPostIds: number[]
}

export enum UserInteractionType {
    LIKE = 'LIKE',
    VIEW = 'VIEW',
}
