import express from 'express';
import { xss } from 'express-xss-sanitizer';
import path from 'node:path'
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { FilesystemPostRepository } from '@repositories/postRepository.js';

const app = express();
const port = 3002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 미들웨어 설정
app.use(xss());


app.get('/', (req, res) => {
    res.send("Hello!");
});

// 파라미터 예제
app.get('/params-example/:userSuppliedParameter', (req,res) => {
    let paramsString = '';
    for (let [k, v] of Object.entries(req.params)) {
        paramsString += String(k) + ':' + String(v);
    }
    res.render('index', {title: 'Params Example', body: paramsString});
});

// 게시글 Repository 설정
const postsDirectory = './data/posts';
const postsRepository = new FilesystemPostRepository(postsDirectory);

// 게시글 CRUD
app.get('/posts', async (req, res) => {

    const posts = await postsRepository.getAllPosts();
    res.render('posts', {title: 'Posts', posts: posts});
});

app.post('/posts', async (req, res) => {
    const postId = String(randomUUID());
    const post = {
        id: postId,
        title: String(req.body.title),
        timestamp: new Date,
        content : String(req.body.content)
    }
    await postsRepository.createPost(post);
    res.redirect(`/posts/${postId}`);
});

app.patch('/posts/:postId', (req,res) => {
    throw new Error('아직 구현되지 않았습니다.');
});

app.delete('/posts/:postId', async (req, res) => {
    try {
        await postsRepository.deletePost(String(req.params.postId));
        res.sendStatus(200);
    } catch (err) {
        let errorMessage;
        if (err instanceof Error) {
            errorMessage = err.message;
        } else {
            errorMessage = String(err);
        }
        console.log('post 삭제 실패: ', errorMessage);
        res.sendStatus(404);
    }
});


app.listen(port);
