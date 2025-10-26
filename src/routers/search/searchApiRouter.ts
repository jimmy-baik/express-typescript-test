import express from 'express';
import { requireLogin } from '../../middlewares/requireLogin';
import { createEmbedding } from '../../services/contentExtractionService';
import { searchPosts } from '../../services/searchService';

const router = express.Router();

// 검색
router.get('/',
    requireLogin,
    async (req, res, next) => {
    try {
        const userQuery = String(req.query.q || '').trim();
        if (!userQuery) {
            return res.status(400).json({ error: '잘못된 요청입니다.', message: '검색어 파라미터가 필요합니다.' });
        }
        const queryEmbedding = await createEmbedding(userQuery);
        const searchResults = await searchPosts(userQuery, queryEmbedding);
        res.json({count: searchResults.length, results: searchResults});
    } catch (err) {
        next(err);
    }
});

export default router;
