export interface User {
    userId: number
    username: string
    hashedPassword: string
    nickname: string | null // UI에 표시되는 이름 (e.g. 홍길동, John)
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
