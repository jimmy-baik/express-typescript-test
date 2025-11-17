export interface IngestionSource {
    sourceId: number, // autoincrement id
    sourceUrl: string, // 소스 URL (예: RSS feed URL)
    createdAt: Date, // 소스 생성 일시
}

export interface FeedIngestionSource extends IngestionSource {
    feedId: number, // 어느 피드에 속한 소스인지 참조
    ownerUserId: number, // 어느 사용자가 추가한 소스인지 참조
    title: string | null, // 소스 제목 (optional)
    description: string | null, // 소스 설명 (optional)
}