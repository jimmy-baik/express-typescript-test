import express from 'express';
import { randomUUID } from 'node:crypto';
import { FilesystemPostRepository } from '../../../repositories/postRepository';
import { FilesystemUserRepository } from '../../../repositories/userRepository';
import { requireLogin } from '../../../middlewares/requireLogin';
import { extractArticleContentFromUrl, summarizeArticleContent, createEmbedding } from '../../../services/contentExtractionService';
import { calculateUserEmbedding } from '../../../services/recommendationService';
import { Post } from '../../../models/posts';
import { User } from '../../../models/users';

const router = express.Router();

// 게시글 Repository 설정
const postsDirectory = './src/data/posts';
const postsRepository = new FilesystemPostRepository(postsDirectory);

// 유저 Repository 설정
const usersDirectory = './src/data/users';
const usersRepository = new FilesystemUserRepository(usersDirectory);

// 게시글 생성
router.post('/',
    requireLogin,
    async (req, res, next) => {
    try {
        // 요청 데이터 검증
        if (!req.body || !req.body.title || !req.body.content) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '제목과 내용을 모두 입력해주세요.'
            });
        }

        if (!req.user || !('username' in req.user) || req.user.username === undefined || req.user.username === null) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '로그인이 필요합니다.'
            });
        }

        const postId = String(randomUUID());
        const post = {
            id: postId,
            title: String(req.body.title),
            timestamp: new Date(),
            content: String(req.body.content),
            createdBy: String(req.user.username),
            summary: null,
            embedding: null,
            sourceUrl: null
        };
        
        await postsRepository.createPost(post);
        res.redirect('/posts');
    } catch (err) {
        // 에러를 다음 미들웨어로 전달
        next(err);
    }
});

// URL에서 게시글 생성
router.post('/from-url',
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

        // 컨텐츠 추출작업 예약
        extractArticleContentFromUrl(sourceUrl, createdByUsername).then(async (post) => {
            // 요약과 임베딩을 병렬로 생성한다
            const [summary, embedding] = await Promise.all([
                summarizeArticleContent(post.content).catch((err) => {
                    console.log(err);
                    return null;
                }),
                createEmbedding(post.content).catch((err) => {
                    console.log(err);
                    return null;
                })
            ]);

            if (summary === null || embedding === null) {
                throw new Error('요약과 임베딩 생성에 실패했습니다.');
            }

            // 요약을 포함하여 게시글을 저장한다
            post.summary = summary;
            post.embedding = embedding;
            post.sourceUrl = sourceUrl;
            await postsRepository.createPost(post);
        }).catch((err) => {
            console.log(err);
        });

        // 작업 예약 후 바로 종료
        res.redirect('/posts');

    } catch (err) {
        // 에러를 다음 미들웨어로 전달
        next(err);
    }
});

// 게시글 수정
router.patch('/:postId', (req,res) => {
    throw new Error('아직 구현되지 않았습니다.');
});

// 게시글 삭제
router.delete('/:postId',
    requireLogin,
    async (req, res) => {
    try {
        if (!req.user || !('username' in req.user) || req.user.username === undefined || req.user.username === null) {
            throw new Error('로그인이 필요합니다.');
        }
        const post = await postsRepository.getPost(String(req.params.postId));
        if (!post) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }
        if (post.createdBy !== req.user.username) {
            throw new Error('자신의 게시글만 삭제할 수 있습니다.');
        }
        await postsRepository.deletePost(String(req.params.postId));
        res.redirect(303, '/posts');
    } catch (err) {
        let errorMessage;
        if (err instanceof Error) {
            errorMessage = err.message;
        } else {
            errorMessage = String(err);
        }
        console.log('post 삭제 실패: ', errorMessage);
        res.sendStatus(404);
    }
});

// 게시글 좋아요
router.post('/:postId/like',
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
        const post = await postsRepository.getPost(postId);
        if (!post) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '게시글을 찾을 수 없습니다.'
            });
        }
        // 내역을 사용자 프로필에 저장한다.
        const likedPosts = await usersRepository.likePost(username, postId);
        (user as User).likedPosts = likedPosts;

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
        const post = await postsRepository.getPost(postId);
        if (!post) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '게시글을 찾을 수 없습니다.'
            });
        }
        const viewedPosts = await usersRepository.viewPost(username, postId);
        (user as User).viewedPosts = viewedPosts;

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
