import express from 'express';
import { PostRepository } from '@repositories/postRepository';
import { UserRepository } from '@repositories/userRepository';
import db from '@adapters/secondary/db/client';
import { getSearchEngine } from '@adapters/secondary/searchengine/searchEngineFactory';
import { requireLogin } from '@adapters/primary/middlewares/requireLogin';
import { calculateUserEmbedding } from '@services/embeddingsService';
import { User } from '@models/users';


const router = express.Router();

// 게시글 Repository 설정
const searchEngine = getSearchEngine(process.env.SEARCH_ENGINE_TYPE || "meilisearch");
const postsRepository = new PostRepository(db, searchEngine);

// 유저 Repository 설정
const usersRepository = new UserRepository(db);


// 게시글 좋아요
router.post('/:postId/like',
    requireLogin,
    async (req, res, next) => {
    try {
        const postId = Number(req.params.postId);
        const user = req.user as User;
        const post = await postsRepository.getPostByPostId(postId);
        if (!post) {
            return res.status(404).json({
                error: '잘못된 요청입니다.',
                message: '컨텐츠를 찾을 수 없습니다.'
            });
        }

        // 내역을 사용자 프로필에 저장한다.
        await usersRepository.likePost(user.userId, postId);
        
        // user embedding 계산 작업을 에약한다.
        usersRepository.getUserInteractionHistory(user.userId)
            .then(async (userInteractionHistory) => await calculateUserEmbedding(userInteractionHistory, postsRepository))
            .then(async (userEmbedding) => {
                if (userEmbedding) {
                    await usersRepository.updateUserEmbedding(user.userId, userEmbedding);
                }   
            });

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
        const postId = Number(req.params.postId);
        const user = req.user as User;
        const post = await postsRepository.getPostByPostId(postId);
        if (!post) {
            return res.status(404).json({
                error: '잘못된 요청입니다.',
                message: '컨텐츠를 찾을 수 없습니다.'
            });
        }

        // 내역을 사용자 프로필에 저장한다.
        await usersRepository.viewPost(user.userId, postId);
        // user embedding 계산 작업을 에약한다.
        usersRepository.getUserInteractionHistory(user.userId)
            .then(async (userInteractionHistory) => await calculateUserEmbedding(userInteractionHistory, postsRepository))
            .then(async (userEmbedding) => {
                if (userEmbedding) {
                    await usersRepository.updateUserEmbedding(user.userId, userEmbedding);
                }   
            });

        res.status(200).send();
    }
    catch (err) {
        next(err);
    }
});

export default router;
