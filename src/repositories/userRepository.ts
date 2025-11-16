import bcrypt from 'bcrypt';
import type { User } from '@models/users';
import { UserInteractionType } from '@models/users';
import db from '@adapters/secondary/db/client';
import { usersTable, userPostInteractionsTable } from '@adapters/secondary/db/schema';
import { eq } from 'drizzle-orm';
import { getUnixTimestamp } from '@system/timezone';


export class UserRepository {
    private db: typeof db;

    constructor(dbClient: typeof db) {
        this.db = dbClient;
    }

    async getUser(userId: number): Promise<User|null> {
        const user = await this.db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1).get();
        if (user === undefined) {
            return null;
        }
        return this.toDomainUser(user);
    }

    async getUserByUsername(username: string): Promise<User|null> {
        const user = await this.db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1).get();
        if (user === undefined) {
            return null;
        }
        return this.toDomainUser(user);
    }

    async createUser(username: string, password: string, fullname: string | null): Promise<User> {
        const hashedPassword = await bcrypt.hash(password, 10);
        const createdAt = getUnixTimestamp();
        const newUser = await this.db.insert(usersTable).values({
            username,
            fullname,
            hashedPassword,
            createdAt,
        }).returning().get();

        return this.toDomainUser(newUser);
    }

    async likePost(userId: number, postId: number): Promise<number> {
        const createdAt = getUnixTimestamp();
        const like = await this.db.insert(userPostInteractionsTable).values({
            userId,
            postId,
            interactionType: UserInteractionType.LIKE,
            createdAt
        }).returning().get();
        return like.id;
    }

    async viewPost(userId: number, postId: number): Promise<number> {
        const createdAt = getUnixTimestamp();
        const view = await this.db.insert(userPostInteractionsTable).values({
            userId,
            postId,
            interactionType: UserInteractionType.VIEW,
            createdAt
        }).returning().get();
        return view.id;
    }

    async updateUserEmbedding(userId: number, embedding: number[]): Promise<void> {
        const updatedUserResult = await this.db.update(usersTable).set({
            userEmbedding: JSON.stringify(embedding),
        }).where(eq(usersTable.userId, userId));
        
        if (updatedUserResult.rowsAffected < 1) {
            throw new Error('user embedding 업데이트 실패');
        }
    }

    private toDomainUser(user: typeof usersTable.$inferSelect): User {
        return {
            userId: user.userId,
            username: user.username,
            fullname: user.fullname,
            hashedPassword: user.hashedPassword,
            createdAt: new Date(user.createdAt),
            userEmbedding: user.userEmbedding ? JSON.parse(user.userEmbedding) : null,
        };
    }

}