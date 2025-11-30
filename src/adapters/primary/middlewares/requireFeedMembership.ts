import express from 'express';
import db from '@adapters/secondary/db/client';
import { FeedRepository } from '@repositories/feedRepository';
import { User } from '@models/users';

// Repository 설정
const feedsRepository = new FeedRepository(db);

// 피드 멤버만 접근을 인가하는 권한 체크 미들웨어
export async function requireFeedMembership(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }

        const user = req.user as User;
        const slug = String(req.params.feedSlug);
        if (!slug) {
            return res.status(404).json({ error: '피드를 찾을 수 없습니다.' });
        }

        const feed = await feedsRepository.getFeedBySlug(slug);
        if (!feed) {
            return res.status(404).json({ error: '피드를 찾을 수 없습니다.' });
        }

        if (!feed.memberUserIds.includes(Number(user.userId))) {
            return res.status(403).json({ error: '피드 멤버가 아닙니다.' });
        }

        // 위 체크 모두 통과시 다음 미들웨어로 이동
        next();
    } catch (err) {
        next(err);
    }
}