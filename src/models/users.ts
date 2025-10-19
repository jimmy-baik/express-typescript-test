export interface User {
    username: string
    hashedPassword: string
    likedPosts: string[]
    viewedPosts: string[]
    userEmbedding: number[] | null
}