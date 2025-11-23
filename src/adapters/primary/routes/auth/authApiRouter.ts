import express from 'express';
import passport from 'passport';

const router = express.Router();

// 로그인 처리
router.post('/login', passport.authenticate('local', {
    successRedirect: '/feeds', 
    failureRedirect: '/login'
}));


// 카카오 로그인 처리
router.get('/kakao', passport.authenticate('kakao'));


// 카카오 로그인 콜백 처리
router.get('/kakao/callback', passport.authenticate('kakao', {
    successRedirect: '/feeds', 
    failureRedirect: '/login'
}));


export default router;
