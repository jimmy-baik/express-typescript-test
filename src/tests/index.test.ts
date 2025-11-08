import request from 'supertest';
import express from 'express';


// 인증을 요구하는 미들웨어를 목업한다

jest.mock('../adapters/primary/middlewares/requireLogin', () => ({
    requireLogin: jest.fn(), // 모듈 내의 함수를 목업으로 대체
}));
const mockRequireLogin = require('../src/middlewares/requireLogin').requireLogin; // 이 시점에서 불러온 함수는 목업된 함수

let app: express.Application;
beforeEach(() => {
    mockRequireLogin.mockImplementation((req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/login');
    });
    app = require('../src/index').default;
});


describe('Protected Routes', () => {
    it('GET /posts returns 302 when without credentials', async () => {
        const res = await request(app)
            .get('/posts')
            .set('Accept', 'application/json');

        expect(res.status).toBe(302);
    });

    it('GET /posts returns 200 when with authenticated user requests', async () => {
        mockRequireLogin.mockImplementation((req: express.Request, res: express.Response, next: express.NextFunction) => {
            // 미들웨어에서 인증이 통과한 것을 가정한다
            next();
        });
        const res = await request(app).get('/posts');
        expect(res.status).toBe(200);
        expect(res.text).toContain('게시글 목록');
    });
});

