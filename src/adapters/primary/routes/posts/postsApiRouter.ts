import express from 'express';
import { randomUUID } from 'node:crypto';
import { PostRepository } from '@repositories/postRepository';
import { UserRepository } from '@repositories/userRepository';
import db from '@adapters/secondary/db/client';
import { opensearchClient } from '@adapters/secondary/opensearch';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { ingestContent } from '@services/contentExtractionService';
import { calculateUserEmbedding } from '@services/embeddingsService';
import { Post } from '@models/posts';
import { User } from '@models/users';
import { stripHtml } from "string-strip-html";

const router = express.Router();

// 게시글 Repository 설정
const postsRepository = new PostRepository(db, opensearchClient);

// 유저 Repository 설정
const usersRepository = new UserRepository(db);


// 게시글 좋아요
router.post('/:postId/like',
    requireLogin,
    async (req, res, next) => {
    try {
        const postId = Number(req.params.postId);
        const user = req.user;
        if (!user || !('username' in user) || user.username === undefined || user.username === null) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '로그인이 필요합니다.'
            });
        }
        const username = String(user.username);
        const post = await postsRepository.getPostByPostId(postId);
        if (!post) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '게시글을 찾을 수 없습니다.'
            });
        }
        // 내역을 사용자 프로필에 저장한다.
        const likedPosts = await usersRepository.likePost(username, postId);
        (user as User).likedPostsId = likedPosts;

        // user embedding 계산 작업을 에약한다.
        calculateUserEmbedding(user as User, postsRepository).then( async (userEmbedding) => {
            if (userEmbedding) {
                await usersRepository.updateUserEmbedding(username, userEmbedding);
            }
        })

        res.status(200).send();
    } catch (err) {
        next(err);
    }
});

// 게시글 열람 기록
router.post('/:postId/viewed',
    requireLogin,
    async (req, res, next) => {
    try {
        const postId = String(req.params.postId);
        const user = req.user;
        if (!user || !('username' in user) || user.username === undefined || user.username === null) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '로그인이 필요합니다.'
            });
        }
        const username = String(user.username);
        const post = await postsRepository.getPostByPostId(postId);
        if (!post) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '게시글을 찾을 수 없습니다.'
            });
        }
        const viewedPosts = await usersRepository.viewPost(username, postId);
        (user as User).viewedPostsId = viewedPosts;

        // user embedding 계산 작업을 에약한다.
        calculateUserEmbedding(user as User, postsRepository).then( async (userEmbedding) => {
            if (userEmbedding) {
                await usersRepository.updateUserEmbedding(username, userEmbedding);
            }
        })

        res.status(200).send();
    }
    catch (err) {
        next(err);
    }
});

export default router;
