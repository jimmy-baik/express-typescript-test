export interface ExtractedContent {
    title: string,
    htmlContent: string,
    textContent: string,
    originalUrl: string
}

export interface Post {
    postId: number, // autoincrement id
    createdAt: Date, // 게시글 정보의 최초 생성 일시. 만일 중복으로 추가되었다면 현재 원본 타임스탬프가 우선
    originalUrl: string, // 컨텐츠 원본 URL
    textContent: string, // 불필요한 요소를 제거한 컨텐츠. 컨텐츠 요약과 임베딩 생성에 사용
    htmlContent: string | null, // html formatted 된 컨텐츠. optional하게 캐시된 버전의 컨텐츠를 보여줘야 할 경우에만 사용
    title: string | null, // 컨텐츠 제목
    generatedSummary: string | null, // 자동 생성된 요약
    embedding: number[] | null, // JSON string으로 저장, nullable
}

export interface FeedPost extends Post {
    feedId: number, // 어느 피드에 속한 게시글인지 참조
    submittedAt: Date, // 게시글 제출 일시
    ownerUserId: number, // 어느 사용자가 추가한 컨텐츠인지 참조
}
