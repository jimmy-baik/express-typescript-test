import express from 'express';
import { PostRepository } from '@repositories/postRepository';
import { FeedRepository } from '@repositories/feedRepository';
import db from '@adapters/secondary/db/client';
import { opensearchClient } from '@adapters/secondary/opensearch';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { User } from '@models/users';
import { Post } from '@models/posts';
import { ingestContent } from '@services/contentExtractionService';
import { searchPostsByEmbeddingWithPagination, getFallbackRecommendations } from '@services/searchService';



const router = express.Router();

// 게시글 Repository 설정
const postsRepository = new PostRepository(db, opensearchClient);

const feedsRepository = new FeedRepository(db);


// 피드 생성
router.post('/',
    requireLogin,
    async (req, res, next) => {
    try {
        if (!req.body || !req.body.title || !req.body.slug) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '제목과 고유 주소를 입력해주세요.'
            });
        }

        const userId = (req.user as User).userId;
        const title = String(req.body.title);
        const slug = String(req.body.slug);
        const feed = await feedsRepository.createFeed(title, slug, userId);
        res.status(201).json(feed);
    }
    catch (err) {
        next(err);
    }
});


// 내 피드 조회
router.get('/my-feeds',
    requireLogin,
    async (req, res, next) => {
    try {
        const userId = (req.user as User).userId;
        const feeds = await feedsRepository.getAllFeedsByUserId(userId);
        res.status(200).json(feeds);
    }
    catch (err) {
        next(err);
    }
});


// 피드 내 추천 게시글 조회
router.get('/:feedId/recommendations',
    requireLogin,
    async (req, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const exclude = req.query.exclude ? (req.query.exclude as string).split(',') : [];

        let posts: Post[] = [];

        if (req.user && 'userEmbedding' in req.user && req.user.userEmbedding) {
            posts = await searchPostsByEmbeddingWithPagination(
                req.user.userEmbedding as number[],
                page,
                limit,
                exclude
            );
        } else {
            // 유저 임베딩이 없을 경우 사용
            posts = await getFallbackRecommendations(
                page,
                limit,
                exclude
            );
        }

        res.json({
            posts: posts,
            hasMore: posts.length === limit,
            page: page
        });
    }
    catch (err) {
        next(err);
    }
});


// 피드에 게시글 추가
router.post('/:feedId/url',
    requireLogin,
    async (req, res, next) => {
    try {
        // 요청 데이터 검증
        if (!req.body || !req.body.url) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: 'URL을 입력해주세요.'
            });
        }

        if (!req.user || !('username' in req.user) || req.user.username === undefined || req.user.username === null) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '로그인이 필요합니다.'
            });
        }

        const createdByUsername = String(req.user.username);
        const sourceUrl = String(req.body.url);

        // ingest 작업 예약
        ingestContent(sourceUrl, createdByUsername, postsRepository);

        // 작업 예약 후 바로 종료
        res.redirect('/posts');

    } catch (err) {
        // 에러를 다음 미들웨어로 전달
        next(err);
    }
});
