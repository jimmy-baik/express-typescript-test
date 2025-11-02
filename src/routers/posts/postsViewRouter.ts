import express from 'express';
import { stripHtml } from "string-strip-html";
import { FilesystemPostRepository } from '../../repositories/postRepository';
import { FilesystemUserRepository } from '../../repositories/userRepository';
import { requireLogin } from '../../middlewares/requireLogin';
import { createPostEmbedding } from '../../services/contentExtractionService';
import { calculateUserEmbedding } from '../../services/recommendationService';
import { searchPosts, searchPostsByEmbedding } from '../../services/searchService';
import { Post } from '../../models/posts';
import { User } from '../../models/users';

const router = express.Router();

// 게시글 Repository 설정
const postsDirectory = './src/data/posts';
const postsRepository = new FilesystemPostRepository(postsDirectory);

// 유저 Repository 설정
const usersDirectory = './src/data/users';
const usersRepository = new FilesystemUserRepository(usersDirectory);

// 게시글 목록 조회
router.get('/',
    requireLogin,
    async (req, res, next) => {
        try {
          const userQuery = String(req.query.q || '').trim();
          let posts: Post[] = [];

          if (userQuery) {
            // 1.검색 - 검색어가 붙어있으면 hybrid search 검색 결과를 표시해준다.
            const queryEmbedding = await createPostEmbedding(userQuery);
            posts = await searchPosts(userQuery, queryEmbedding) || [];
          } else if (req.user && 'userEmbedding' in req.user && req.user.userEmbedding as number[]) {
            // 2. 추천 - 검색어는 없는데 user embedding이 있으면 user embedding을 이용해서 추천 아티클을 검색한다.
            posts = await searchPostsByEmbedding(req.user.userEmbedding as number[]) || [];
          } else {
            // 3. cold start - 검색어도 없고 user embedding도 없으면 모든 게시글을 조회한다
            posts = await postsRepository.getAllPosts() || [];
          }

          const htmlStrippedPosts = posts.map(post => {
            post.content = stripHtml(post.content.substring(0, 200)).result || stripHtml(post.content).result.substring(0, 200);
            return post;
          });

          res.render('posts', {title: '게시글 목록', posts: htmlStrippedPosts, userLikedPosts: (req.user as User)?.likedPosts || []});

        }
    catch (err) {
        next(err);
    }
});

// 새 URL 스크랩 페이지
router.get('/new-url',
    requireLogin,
    async (req, res, next) => {
    try {
        res.render('new-url', {title: '새 스크랩'});
    } catch (err) {
        next(err);
    }
});

export default router;
