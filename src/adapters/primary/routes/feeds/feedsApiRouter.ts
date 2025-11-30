import express from 'express';
import db from '@adapters/secondary/db/client';
import { PostRepository } from '@repositories/postRepository';
import { FeedRepository } from '@repositories/feedRepository';
import { UserRepository } from '@repositories/userRepository';
import { opensearchClient } from '@adapters/secondary/opensearch';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { User } from '@models/users';
import { ingestContent } from '@services/contentExtractionService';
import { getRecommendationsForUser } from '@services/searchService';
import { generateRandomString } from '@system/generators';

const router = express.Router();

// 게시글 Repository 설정
const postsRepository = new PostRepository(db, opensearchClient);
const usersRepository = new UserRepository(db);
const feedsRepository = new FeedRepository(db);


// 피드 생성
router.post('/',
    requireLogin,
    async (req, res, next) => {
    try {
        if (!req.body || !req.body.title) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '제목을 입력해주세요.'
            });
        }

        const userId = (req.user as User).userId;
        const title = String(req.body.title);
        const slug = generateRandomString(10); // 10자리의 랜덤 문자열을 생성해서 url slug로 사용한다
        const feed = await feedsRepository.createFeed(title, slug, userId);
        // 피드 목록으로 리다이렉트
        res.redirect(`/feeds`);
    }
    catch (err) {
        next(err);
    }
});


// 무한 스크롤시 피드의 추천 게시글을 계속 조회하는 경로
router.get('/:feedSlug/recommendations',
    requireLogin,
    async (req, res, next) => {
    try {

        const limit = parseInt(req.query.limit as string) || 10;
        const excludeIds = req.query.exclude ? (req.query.exclude as string).split(',').map(id => parseInt(id)) : [];

        const user = req.user as User;
        const feedSlug = String(req.params.feedSlug);
        const feed = await feedsRepository.getFeedBySlug(feedSlug);
        if (!feed) {
            return res.status(404).json({
                error: '피드를 찾을 수 없습니다.',
                message: '피드를 찾을 수 없습니다.'
            });
        }

        const {posts, userInteractionHistory} = await getRecommendationsForUser(user, feed, usersRepository, postsRepository, limit, excludeIds);

        res.json({
            posts: posts,
            hasMore: posts.length === limit
        });
    }
    catch (err) {
        next(err);
    }
});


// 피드에 게시글 추가
router.post('/:feedSlug/url',
    requireLogin,
    async (req, res, next) => {
    try {
        const feedSlug = String(req.params.feedSlug);
        const feed = await feedsRepository.getFeedBySlug(feedSlug);
        if (!feed) {
            return res.status(404).json({
                error: '피드를 찾을 수 없습니다.',
                message: '피드를 찾을 수 없습니다.'
            });
        }

        const userId = (req.user as User).userId;
        if (!feed.memberUserIds.includes(userId)) {
            return res.status(403).json({
                error: '권한이 없습니다.',
                message: '자신이 속해 있는 피드에만 컨텐츠를 추가할 수 있습니다.'
            });
        }

        // 요청 데이터 검증
        if (!req.body || !req.body.url) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: 'URL을 입력해주세요.'
            });
        }
        const originalUrl = String(req.body.url);

        // ingest 작업 예약
        ingestContent(originalUrl, feed.feedId, userId, postsRepository);

        // 작업 예약 후 바로 종료
        res.redirect(`/feeds/${feedSlug}`);

    } catch (err) {
        // 에러를 다음 미들웨어로 전달
        next(err);
    }
});

export default router;