import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";


export const usersTable = sqliteTable("users", {
  username: text().primaryKey(), // 사용자 이름 (e.g. user123). 소셜로그인일 경우 소셜 로그인 서비스에서 제공하는 고유 id를 사용
  fullname: text().notNull(), // 사용자 이름 (e.g. 홍길동)
  hashedPassword: text().notNull(),
  userEmbedding: text(), // JSON string으로 저장된 embedding vector
});
    
export const feedsTable = sqliteTable("feeds", {
    feedId: text().primaryKey(), // uuid4 형식의 고유 id
    ownerUsername: text().notNull().references(() => usersTable.username),
    createdAt: int().notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
    title: text().notNull(), // 사용자가 지정한 피드 제목
});

export const feedUserMembershipTable = sqliteTable("feed_user_membership", {
    feedId: text().notNull().references(() => feedsTable.feedId),
    username: text().notNull().references(() => usersTable.username),
});

export const postsTable = sqliteTable("posts", {
    postId: text().primaryKey(), // uuid4 형식의 고유 id
    feedId: text().notNull().references(() => feedsTable.feedId), // 어느 피드에 추가된 컨텐츠인지 참조
    ownerUsername: text().notNull().references(() => usersTable.username), // 어느 사용자가 추가한 컨텐츠인지 참조
    timestamp: int().notNull(), // sqlite는 timestamp 타입이 없으므로 unix timestamp int로 저장
    title: text().notNull(), // 컨텐츠 제목
    content: text().notNull(), // 불필요한 요소를 제거한 컨텐츠. 컨텐츠 요약과 임베딩 생성에 사용
    sourceUrl: text().notNull(), // 컨텐츠 원본 URL
    htmlContent: text(), // html formatted 된 컨텐츠. optional하게 캐시된 버전의 컨텐츠를 보여줘야 할 경우에만 사용
    summary: text(), // 컨텐츠 요약
    embedding: text(), // JSON string으로 저장, nullable
});

export const userPostInteractionsTable = sqliteTable("user_post_interactions", {
    id: int().primaryKey({ autoIncrement: true }), // 기본 키. autoIncrement 사용
    timestamp: int().notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
    username: text().notNull().references(() => usersTable.username), // 어떤 사용자의 기록인지 참조
    postId: text().notNull().references(() => postsTable.postId), // 어떤 게시글과의 상호작용인지 참조
    interactionType: text({ enum: ['LIKE', 'VIEW'] }).notNull(), // 상호작용 유형. 좋아요를 클릭했는지, 열람 기록을 남겼는지 여부
});
