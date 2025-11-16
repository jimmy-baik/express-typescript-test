export interface User {
    userId: number
    username: string
    fullname: string
    hashedPassword: string
    createdAt: Date
    userEmbedding: number[] | null
}

export interface UserInteractionHistory {
    likedPostIds: number[]
    viewedPostIds: number[]
}
