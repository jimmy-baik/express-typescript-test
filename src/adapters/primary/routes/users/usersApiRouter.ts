import express from 'express';
import { UserRepository } from '@repositories/userRepository';
import db from '@adapters/secondary/db/client';

const router = express.Router();

// 유저 Repository 설정
const usersRepository = new UserRepository(db);

// username validation 함수
function isAsciiCharactersOnly(str: string): boolean {
    return /^[\x00-\x7F]*$/.test(str);
}

// user 생성 - 지금은 사용하지 않음
// router.post('/', async (req, res, next) => {
//     if (!req.body || !req.body.username || !req.body.password) {
//         return res.status(400).json({
//             error: '잘못된 요청입니다.',
//             message: '아이디와 비밀번호를 입력해주세요.'
//         });
//     }

//     if (!isAsciiCharactersOnly(req.body.username)) {
//         return res.status(422).json({
//             error: '잘못된 요청입니다.',
//             message: '아이디는 영문자와 숫자만 사용할 수 있습니다.'
//         });
//     }

//     const fullname = req.body.fullname ? req.body.fullname : null;

//     try {
//         await usersRepository.createUser(req.body.username, req.body.password, fullname);
//         res.redirect('/login');
//     } catch (err) {
//         next(err);
//     }
// });

export default router;
