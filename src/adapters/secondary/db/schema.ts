import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";


export const usersTable = sqliteTable("users", {
  userId: int('user_id').primaryKey({ autoIncrement: true }), // 기본 키. autoIncrement 사용
  username: text().notNull().unique(), // 사용자 계정명 (e.g. user123). 소셜로그인일 경우 소셜 로그인 서비스에서 제공하는 고유 id를 사용
  fullname: text().notNull(), // 사용자 이름 (e.g. 홍길동)
  hashedPassword: text('hashed_password').notNull(),
  createdAt: int('created_at').notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
  userEmbedding: text('user_embedding'), // JSON string으로 저장된 embedding vector
});

export const feedsTable = sqliteTable("feeds", {
    feedId: int('feed_id').primaryKey({ autoIncrement : true }), // autoincrement id
    slug: text().notNull().unique(), // url에 노출될 피드의 고유 주소
    title: text().notNull(), // 사용자가 지정한 피드 제목
    createdAt: int('created_at').notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
    ownerUserId: int('owner_user_id').notNull().references(() => usersTable.userId),
});

export const postsTable = sqliteTable("posts", {
    postId: int('post_id').primaryKey({ autoIncrement: true }), // autoincrement id
    createdAt: int('created_at').notNull(), // sqlite는 timestamp 타입이 없으므로 unix timestamp int로 저장
    originalUrl: text('original_url').notNull(), // 컨텐츠 원본 URL
    textContent: text().notNull(), // 불필요한 요소를 제거한 컨텐츠. 컨텐츠 요약과 임베딩 생성에 사용
    htmlContent: text('html_content'), // html formatted 된 컨텐츠. optional하게 캐시된 버전의 컨텐츠를 보여줘야 할 경우에만 사용
    title: text(), // 컨텐츠 제목
    generatedSummary: text('generated_summary'), // 자동 생성된 요약
    embedding: text(), // JSON string으로 저장, nullable
});

export const ingestionSourcesTable = sqliteTable("ingestion_sources", {
    sourceId: int('source_id').primaryKey({ autoIncrement: true }), // autoincrement id
    sourceUrl: text('source_url').notNull().unique(), // 소스 URL (예: RSS feed URL)
    createdAt: int('created_at').notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
});

// 다대다 mapping 테이블
export const feedMembers = sqliteTable("feed_members", {
    feedId: int('feed_id').primaryKey().references(() => feedsTable.feedId),
    userId: int('user_id').primaryKey().references(() => usersTable.userId),
});

export const feedPostsTable = sqliteTable("feed_posts", {
    feedId: int('feed_id').notNull().references(() => feedsTable.feedId),
    postId: int('post_id').notNull().references(() => postsTable.postId),
    ownerUserId: int('owner_user_id').notNull().references(() => usersTable.userId), // 어느 사용자가 추가한 컨텐츠인지 참조
    submittedAt: int('submitted_at').notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장 // 원본 post의 createdAt과는 별개로 현재 owner가 언제 추가했는지를 기록
});

export const feedIngestionSourcesTable = sqliteTable("feed_ingestion_sources", {
    feedId: int('feed_id').notNull().references(() => feedsTable.feedId),
    sourceId: int('source_id').notNull().references(() => ingestionSourcesTable.sourceId),
    ownerUserId: int('owner_user_id').notNull().references(() => usersTable.userId), // 어느 사용자가 추가한 소스인지 참조
    title: text(), // 소스 제목 (optional)
    description: text(), // 소스 설명 (optional)
});

// 사용자 선호도 기록
export const userPostInteractionsTable = sqliteTable("user_post_interactions", {
    id: int().primaryKey({ autoIncrement: true }), // 기본 키. autoIncrement 사용
    createdAt: int('created_at').notNull(), // sqlite는 timestamp 타입이 없으므로 int로 저장
    userId: int('user_id').notNull().references(() => usersTable.userId), // 어떤 사용자의 기록인지 참조
    postId: int('post_id').notNull().references(() => postsTable.postId), // 어떤 게시글과의 상호작용인지 참조
    interactionType: text('interaction_type', { enum: ['LIKE', 'VIEW'] }).notNull(), // 상호작용 유형. 좋아요를 클릭했는지, 열람 기록을 남겼는지 여부
});
