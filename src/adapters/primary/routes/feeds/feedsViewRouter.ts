import express from 'express';
import { stripHtml } from "string-strip-html";
import db from '@adapters/secondary/db/client';
import { opensearchClient } from '@adapters/secondary/opensearch';
import { PostRepository } from '@repositories/postRepository';
import { UserRepository } from '@repositories/userRepository';
import { FeedRepository } from '@repositories/feedRepository';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { createPostEmbedding } from '@services/contentExtractionService';
import { searchPostsInFeedByKeyword, searchPostsInFeedByEmbedding } from '@services/searchService';
import { Post } from '@models/posts';
import { User } from '@models/users';

const router = express.Router();

// Repository 설정
const postsRepository = new PostRepository(db, opensearchClient);
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
                    const posts = await postsRepository.getAllPostsInFeed(feed.feedId, 3);
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

// 피드의 컨텐츠 목록 조회
router.get('/:feedSlug',
    requireLogin,
    async (req, res, next) => {
        try {

          const user = req.user as User;
          const feedSlug = String(req.params.feedSlug);
          const feed = await feedsRepository.getFeedBySlug(feedSlug);
          if (!feed) {
            return res.status(404).json({
              error: '잘못된 요청입니다.',
              message: '경로를 찾을 수 없습니다.'
            });
          }

          // 이전에 계산되었던 user embedding이 있으면 user embedding을 이용해서 추천 아티클을 검색한다. 없으면 최신순으로 불러온다.
          const postsPromise = user.userEmbedding ? searchPostsInFeedByEmbedding(user.userEmbedding, feed.feedId) : postsRepository.getAllPostsInFeed(feed.feedId);
          const userInteractionHistoryPromise = usersRepository.getUserInteractionHistory(user.userId);

          const [posts, userInteractionHistory] = await Promise.all([postsPromise, userInteractionHistoryPromise]);

          res.render('posts', {title: '게시글 목록', posts: posts, userLikedPosts: userInteractionHistory.likedPostIds});

        }
    catch (err) {
        next(err);
    }
});

// 새 URL 스크랩 페이지
router.get('/:feedSlug/new-url',
    requireLogin,
    async (req, res, next) => {
    try {
        res.render('new-url', {title: '새 스크랩'});
    } catch (err) {
        next(err);
    }
});

export default router;
