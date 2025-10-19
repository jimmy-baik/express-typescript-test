import express from 'express';


const router = express.Router();

// 로그인 페이지
router.get('/login', (req, res) => {
    res.render('login', {title: 'Login'});
});

export default router;
