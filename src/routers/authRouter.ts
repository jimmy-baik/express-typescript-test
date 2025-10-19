import express from 'express';
import passport from 'passport';

const router = express.Router();

// 로그인
router.get('/login', (req, res) => {
    res.render('login', {title: 'Login'});
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/posts', 
    failureRedirect: '/login'
}));

export default router;
