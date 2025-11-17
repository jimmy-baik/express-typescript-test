export interface Feed  {
    feedId: number, // autoincrement id
    slug: string, // url에 노출될 피드의 고유 주소
    title: string, // 사용자가 지정한 피드 제목
    createdAt: Date, // 피드 생성 일시
    ownerUserId: number, // 어느 사용자가 소유한 피드인지 참조
    memberUserIds: number[] // 피드에 소속된 사용자들의 id. (피드 소유자도 포함)
}