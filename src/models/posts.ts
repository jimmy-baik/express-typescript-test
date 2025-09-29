export interface Post {
    id: string
    timestamp: Date
    title: string
    content: string
    createdBy: string
    sourceUrl: string | null
    summary: string | null
    embedding: number[] | null
}
