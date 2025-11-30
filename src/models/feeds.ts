export interface Feed  {
    feedId: number, // autoincrement id
    slug: string, // url에 노출될 피드의 고유 주소
    title: string, // 사용자가 지정한 피드 제목
    createdAt: Date, // 피드 생성 일시
    ownerUserId: number, // 어느 사용자가 소유한 피드인지 참조
    memberUserIds: number[] // 피드에 소속된 사용자들의 id. (피드 소유자도 포함)
}

// 피드 초대 정보
export interface FeedInvite {
    inviteId: number, // autoincrement id
    feedId: number, // 어느 피드에 초대되었는지 참조
    inviteToken: string, // 초대 토큰
    createdByUserId: number, // 초대를 생성한 user id
    createdAt: Date, // 초대 생성 일시
    expiresAt: Date, // 초대 만료 일시
    isActive: boolean, // 초대 유효성 여부. 유효기간이 지나기 전이라도 active 여부가 false일 경우 링크 사용 불가능
}
