import request from 'supertest';
import app from '../src/index';


describe('Protected routes', () => {
    it('GET /posts returns 302 when without credentials', async () => {
        const res = await request(app)
            .get('/posts')
            .set('Accept', 'application/json');

        expect(res.status).toBe(302);
    });
});