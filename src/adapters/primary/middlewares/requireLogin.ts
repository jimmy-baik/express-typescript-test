import express from 'express';

// 로그인 강제 미들웨어
export function requireLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }

    // express session 정보에 로그인 처리후 리다이렉트할 URL을 저장해놓는다.
    req.session.returnToUrl = req.originalUrl;
    res.redirect('/');
}