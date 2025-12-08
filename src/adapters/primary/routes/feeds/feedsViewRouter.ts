import express from 'express';
import { stripHtml } from "string-strip-html";
import db from '@adapters/secondary/db/client';
import { opensearchClient } from '@adapters/secondary/opensearch';
import { getSearchEngine } from '@adapters/secondary/searchengine/searchEngineFactory';
import { PostRepository } from '@repositories/postRepository';
import { UserRepository } from '@repositories/userRepository';
import { FeedRepository } from '@repositories/feedRepository';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { requireFeedMembership } from '@adapters/primary/middlewares/requireFeedMembership';
import { createPostEmbedding } from '@services/contentExtractionService';
import { searchPostsInFeedByKeyword, searchPostsInFeedByEmbedding } from '@services/searchService';
import { Post } from '@models/posts';
import { User } from '@models/users';
import { generateRandomString } from '@system/generators';

const router = express.Router();

// Repository 설정
const searchEngine = getSearchEngine(process.env.SEARCH_ENGINE_TYPE || "meilisearch");
const postsRepository = new PostRepository(db, searchEngine);
const feedsRepository = new FeedRepository(db);
const usersRepository = new UserRepository(db);

// 피드 목록 조회
router.get('/',
    requireLogin,
    async (req, res, next) => {
        try {
            const user = req.user as User;

            // 사용자가 속한 피드를 모두 조회
            const feeds = await feedsRepository.getAllFeedsByUserId(user.userId);
            
            // 각 피드에 대해 최근 3개의 게시글을 가져옴
            const feedsWithPosts = await Promise.all(
                feeds.map(async (feed) => {
                    const posts = await postsRepository.getAllPostsInFeed(feed.feedId, 3).catch(err => []);
                    return {
                        ...feed,
                        posts: posts
                    };
                })
            );

            res.render('feeds', {
                title: '피드 목록',
                feeds: feedsWithPosts
            });
        } catch (err) {
            next(err);
        }
    }
);

// 새 피드 작성 페이지
router.get('/new',
    requireLogin,
    async (req, res, next) => {
        try {
            res.render('new-feed', {title: '피드 추가하기'});
        } catch (err) {
            next(err);
        }
    }
);

// 단일 피드 조회 (피드의 최초 추천 게시글 열람)
router.get('/:feedSlug',
    requireLogin,
    requireFeedMembership,
    async (req, res, next) => {
        try {

          const user = req.user as User;
          const feed = await feedsRepository.getFeedBySlug(String(req.params.feedSlug));
          if (!feed) {
            return res.status(404).json({
              error: '잘못된 요청입니다.',
              message: '경로를 찾을 수 없습니다.'
            });
          }

          // 이전에 계산되었던 user embedding이 있으면 user embedding을 이용해서 추천 아티클을 검색한다. 없으면 최신순으로 불러온다.
          const postsPromise = user.userEmbedding ? searchPostsInFeedByEmbedding(user.userEmbedding, feed.feedId) : postsRepository.getAllPostsInFeed(feed.feedId);
          postsPromise.catch(err => []);
          const userInteractionHistoryPromise = usersRepository.getUserInteractionHistory(user.userId);

          const [posts, userInteractionHistory] = await Promise.all([postsPromise, userInteractionHistoryPromise]);

          res.render('posts', {
            title: feed.title, 
            posts: posts,
            userLikedPosts: userInteractionHistory.likedPostIds,
            feedSlug: req.params.feedSlug,
            showAddContentBtn: true
          });

        }
    catch (err) {
        next(err);
    }
});

// 새 URL 스크랩 페이지
router.get('/:feedSlug/new-url',
    requireLogin,
    requireFeedMembership,
    async (req, res, next) => {
    try {
        res.render('new-url', {title: '컨텐츠 추가하기', feedSlug: String(req.params.feedSlug)});
    } catch (err) {
        next(err);
    }
});

// 새 초대 링크를 생성, 표시하는 페이지
router.get('/:feedSlug/invites/new',
    requireLogin,
    requireFeedMembership,
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
        
        // 피드에 속한 사람이 아니라면 생성 불가
        if (feed.ownerUserId !== userId && !feed.memberUserIds.includes(userId)) {
            return res.status(403).json({
                error: '권한이 없습니다.',
                message: '피드 멤버만 초대 링크를 생성할 수 있습니다.'
            });
        }

        // 기본 유효기간은 7일로 생성한다
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // 랜덤한 토큰 문자열을 생성한다
        const inviteToken = generateRandomString(12);

        const invite = await feedsRepository.createFeedInvite(
            feed.feedId,
            userId,
            inviteToken,
            expiresAt
        );

        // 초대 링크 URL을 조립한다
        const baseUrl = process.env.CURRENT_SERVER_ROOT_URL || 'http://localhost:3002';
        const inviteUrl = `${baseUrl}/feeds/invite/${invite.inviteToken}`;

        res.render('new-invite', {title: '초대 링크 생성하기', feedSlug: String(req.params.feedSlug), inviteUrl: inviteUrl});
    } catch (err) {
        next(err);
    }
});


// 초대 링크를 가진 사용자가 접근시 초대를 처리하는 경로. 이 경로는 피드에 속하지 않은 사용자가 바로 접근 가능 (inviteToken이 유효할 경우 바로 인가)
router.get('/invite/:inviteToken',
    requireLogin,
    async (req, res, next) => {
    try {
        const user = req.user as User;
        const inviteToken = String(req.params.inviteToken);
        
        // 토큰 문자열과 일치하는 초대링크가 있는지 확인한다. 없으면 거절. 유효기간이 만료되거나 취소되었을 경우에도 거절.
        const invite = await feedsRepository.getFeedInviteByInviteToken(inviteToken);
        if (!invite || !invite.isActive || invite.expiresAt < new Date()) {
            return res.status(404).json({
                error: '초대 링크 오류',
                message: '이 초대 링크는 만료되었거나 취소되었습니다.'
            });
        }

        // 초대 링크를 사용한 사용자를 피드 멤버에 추가한다. (이미 추가되어 있으면 무시)
        await feedsRepository.createUserToFeedMembership(invite.feedId, user.userId);

        // 자신의 피드 목록을 보여주는 경로로 리다이렉트한다
        res.redirect(`/feeds`);

    } catch (err) {
        next(err);
    }
});

export default router;
