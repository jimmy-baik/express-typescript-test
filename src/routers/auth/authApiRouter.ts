import express from 'express';
import passport from 'passport';

const router = express.Router();

// 로그인 처리
router.post('/login', passport.authenticate('local', {
    successRedirect: '/posts', 
    failureRedirect: '/login'
}));

export default router;
