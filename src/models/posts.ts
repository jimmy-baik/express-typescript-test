export interface Post {
    id: string
    timestamp: Date
    title: string
    content: string
    createdBy: string
    summary: string | null
    embedding: number[] | null
}
