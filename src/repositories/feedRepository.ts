
import { eq, sql, and } from 'drizzle-orm';
import db from '@adapters/secondary/db/client';
import { feedsTable, feedMembersTable, feedInvitesTable } from '@adapters/secondary/db/schema';
import { Feed, FeedInvite } from '@models/feeds';
import { getUnixTimestamp, unixTimestampToDate, dateToUnixTimestamp } from '@system/timezone';


export class FeedRepository {
    private db: typeof db;

    constructor(dbClient: typeof db) {
        this.db = dbClient;
    }

    /**
     * 새 피드를 생성한다.
     * @param title 피드 제목
     * @param slug 피드 고유 주소
     * @param ownerUserId 피드 소유자 ID
     * @returns 생성된 피드
     */
    async createFeed(title: string, slug: string, ownerUserId: number): Promise<Feed> {

        let newFeed: typeof feedsTable.$inferSelect | null = null;
        await this.db.transaction(async (tx) => {
            // 새 피드를 만든다
            newFeed = await tx.insert(feedsTable).values({
                title: title,
                slug: slug,
                ownerUserId: ownerUserId,
                createdAt: getUnixTimestamp(),
            }).returning().get();

            // 피드 소유자를 피드 멤버에 추가한다
            await tx.insert(feedMembersTable).values({
                feedId: newFeed.feedId,
                userId: ownerUserId,
            });

        });
        
        if (newFeed === null) {
            throw new Error('피드 생성 실패');
        }
        
        return this.toDomainFeed(newFeed, [ownerUserId]);
    }

    
   /**
    * 사용자를 피드 멤버에 추가한다.
    * @param feedId 피드 id
    * @param userId 사용자 id
   */
    async createUserToFeedMembership(feedId: number, userId: number): Promise<void> {
        const existingMembership = await this.db.select().from(feedMembersTable).where(and(eq(feedMembersTable.feedId, feedId), eq(feedMembersTable.userId, userId))).limit(1).get();
        if (existingMembership) {
            console.log(`이미 피드 멤버에 추가되어 있습니다. feedId: ${feedId}, userId: ${userId}`);
            return;
        }
        
        await this.db.insert(feedMembersTable).values({
            feedId: feedId,
            userId: userId,
        });
    }

   /**
    * 사용자를 피드 멤버에서 제거한다.
    * @param feedId 피드 id
    * @param userId 사용자 id
   */
    async deleteUserFromFeed(feedId: number, userId: number): Promise<void> {
        await this.db.delete(feedMembersTable).where(and(eq(feedMembersTable.feedId, feedId), eq(feedMembersTable.userId, userId)));
    }

    /**
     * 사용자가 속해 있는 모든 피드를 조회한다.
     */
    async getAllFeedsByUserId(userId: number): Promise<Feed[]> {
        const feeds = await this.db
            .select({
                feedId: feedsTable.feedId,
                slug: feedsTable.slug,
                title: feedsTable.title,
                createdAt: feedsTable.createdAt,
                ownerUserId: feedsTable.ownerUserId,
                memberUserIds: sql<string>`GROUP_CONCAT(${feedMembersTable.userId})`.as('memberUserIds'),
            })
            .from(feedsTable)
            .innerJoin(feedMembersTable, eq(feedsTable.feedId, feedMembersTable.feedId))
            .where(
                sql`${feedsTable.feedId} IN (
                    SELECT ${feedMembersTable.feedId} 
                    FROM ${feedMembersTable} 
                    WHERE ${feedMembersTable.userId} = ${userId}
                )`
            )
            .groupBy(
                feedsTable.feedId,
                feedsTable.slug,
                feedsTable.title,
                feedsTable.createdAt,
                feedsTable.ownerUserId
            );
        
        return feeds.map(feed => {
            const memberUserIds = feed.memberUserIds ? feed.memberUserIds.split(',').map(id => parseInt(id, 10)) : []; // 문자열을 콤마 split 후 int로 변환하여 처리. 없으면 빈 배열 반환
            return this.toDomainFeed(feed, memberUserIds);
        });
    }

    async getFeedBySlug(slug: string): Promise<Feed|null> {
        const feed = await this.db
            .select({
                feedId: feedsTable.feedId,
                slug: feedsTable.slug,
                title: feedsTable.title,
                createdAt: feedsTable.createdAt,
                ownerUserId: feedsTable.ownerUserId,
                memberUserIds: sql<string>`GROUP_CONCAT(${feedMembersTable.userId})`.as('memberUserIds'),
            })
            .from(feedsTable)
            .innerJoin(feedMembersTable, eq(feedsTable.feedId, feedMembersTable.feedId))
            .where(eq(feedsTable.slug, slug))
            .groupBy(
                feedsTable.feedId,
                feedsTable.slug,
                feedsTable.title,
                feedsTable.createdAt,
                feedsTable.ownerUserId
            )
            .limit(1)
            .get();

        if (!feed) {
            return null;
        }
        const memberUserIds = feed.memberUserIds ? feed.memberUserIds.split(',').map(id => parseInt(id, 10)) : [];
        return this.toDomainFeed(feed, memberUserIds);
    }


    /**
     * 피드 초대 정보를 생성한다.
     * @param feedId 피드 id
     * @param createdByUserId 초대를 생성한 user id
     * @param inviteTokenString 초대 토큰
     * @param expiresAt 초대 만료 일시
     * @returns 생성된 초대 정보
     */
    async createFeedInvite(feedId: number, createdByUserId: number, inviteTokenString: string, expiresAt: Date): Promise<FeedInvite> {
        const invite = await this.db.insert(feedInvitesTable).values({
            feedId: feedId,
            inviteToken: inviteTokenString,
            createdByUserId: createdByUserId,
            createdAt: getUnixTimestamp(),
            expiresAt: dateToUnixTimestamp(expiresAt),
            isActive: 1,
        }).returning().get();
        return this.toDomainFeedInvite(invite);
    }

    /**
     * 초대 토큰으로 피드 초대 정보를 조회한다.
     * @param inviteToken 초대 토큰
     * @returns 조회된 피드 초대 정보. 조회되지 않으면 null 반환
     */
    async getFeedInviteByInviteToken(inviteToken: string): Promise<FeedInvite | null> {
        const invite = await this.db
            .select()
            .from(feedInvitesTable)
            .where(eq(feedInvitesTable.inviteToken, inviteToken))
            .limit(1)
            .get();

        if (!invite) {
            return null;
        }

        return this.toDomainFeedInvite(invite);
    }

    private toDomainFeed(dbFeed: typeof feedsTable.$inferSelect, memberUserIds: number[]): Feed {
        return {
            ...dbFeed,
            createdAt: unixTimestampToDate(dbFeed.createdAt),
            memberUserIds: memberUserIds,
        };
    }

    private toDomainFeedInvite(dbInvite: typeof feedInvitesTable.$inferSelect): FeedInvite {
        return {
            ...dbInvite,
            createdAt: unixTimestampToDate(dbInvite.createdAt),
            expiresAt: unixTimestampToDate(dbInvite.expiresAt),
            isActive: dbInvite.isActive === 1,
        };
    }

}