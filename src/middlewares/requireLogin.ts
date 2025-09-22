import express from 'express';

// 로그인 강제 미들웨어
export function requireLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}