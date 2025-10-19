import express from 'express';
import { FilesystemUserRepository } from '../../repositories/userRepository';

const router = express.Router();

// 유저 Repository 설정
const usersDirectory = './src/data/users';
const usersRepository = new FilesystemUserRepository(usersDirectory);

// user 생성
router.post('/', async (req, res, next) => {
    if (!req.body || !req.body.username || !req.body.password) {
        return res.status(400).json({
            error: '잘못된 요청입니다.',
            message: '아이디와 비밀번호를 입력해주세요.'
        });
    }

    try {
        await usersRepository.createUser(req.body.username, req.body.password);
        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

export default router;
