import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import helmet from 'helmet';
import path from 'node:path'
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { User } from './models/users.js';
import { FilesystemPostRepository } from './repositories/postRepository.js';
import { FilesystemUserRepository } from './repositories/userRepository.js';

// 환경변수 불러오기
dotenv.config();

const app = express();
const port = 3002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 미들웨어 설정

// 요청 body 해석
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 보안 헤더
app.use(helmet());
// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET_KEY || 'placeholder-secret-key',
    resave: false,
    saveUninitialized: false
}));


// 게시글 Repository 설정
const postsDirectory = './src/data/posts';
const postsRepository = new FilesystemPostRepository(postsDirectory);

// 유저 Repository 설정
const usersDirectory = './src/data/users';
const usersRepository = new FilesystemUserRepository(usersDirectory);


// passport 설정
app.use(passport.initialize());
app.use(passport.session());

// passport local strategy 설정
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => { // verify 함수
    try {

        const user = await usersRepository.getUser(username);
        if (!user) {
            return done(null, false);
        }

        const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
        if (!isPasswordValid) {
            return done(null, false);
        }

        return done(null, user);

    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    if ('username' in user && user.username !== undefined) {
        done(null, user.username);
    } else {
        done(new Error('정상적인 User 객체가 아닙니다.'));
    }
});

passport.deserializeUser(async (username: string, done) => {
    try {
        const user = await usersRepository.getUser(username);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

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

// 로그인
app.get('/login', (req, res) => {
    res.render('login', {title: 'Login'});
});

app.post('/login', passport.authenticate('local', {successRedirect: '/posts', failureRedirect: '/login'}));

// 로그인 강제 미들웨어
function requireLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// user 생성
app.post('/users', async (req, res, next) => {
    if (!req.body || !req.body.username || !req.body.password) {
        return res.status(400).json({
            error: '잘못된 요청입니다.',
            message: '아이디와 비밀번호를 입력해주세요.'
        });
    }

    try {
        await usersRepository.createUser(req.body.username, req.body.password);
        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

// 게시글 CRUD
app.get('/posts',
    requireLogin,
    async (req, res, next) => {
        try {
            const posts = await postsRepository.getAllPosts();
            console.log(posts);
            res.render('posts', {title: '게시글 목록', posts: posts});
        } catch (err) {
            next(err);
        }
    }
);

app.post('/posts',
    requireLogin,
    async (req, res, next) => {
    try {
        // 요청 데이터 검증
        if (!req.body || !req.body.title || !req.body.content) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '제목과 내용을 모두 입력해주세요.'
            });
        }

        if (!req.user || !('username' in req.user) || req.user.username === undefined || req.user.username === null) {
            return res.status(400).json({
                error: '잘못된 요청입니다.',
                message: '로그인이 필요합니다.'
            });
        }

        const postId = String(randomUUID());
        const post = {
            id: postId,
            title: String(req.body.title),
            timestamp: new Date(),
            content: String(req.body.content),
            createdBy: String(req.user.username)
        };
        
        await postsRepository.createPost(post);
        res.redirect('/posts');
    } catch (err) {
        // 에러를 다음 미들웨어로 전달
        next(err);
    }
});

app.get('/posts/new',
    requireLogin,
    async (req, res, next) => {
    try {
        res.render('new-post', {title: '새 게시글'});
    } catch (err) {
        next(err);
    }
});

app.get('/posts/:postId',
    requireLogin,
    async (req,res) => {
    try {
        const postId = String(req.params.postId);
        const post = await postsRepository.getPost(postId);
        if (!post) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }
        res.render('single-post', {title: '게시글', post: post});
    } catch (err) {
        res.sendStatus(404);
    }
});

app.patch('/posts/:postId', (req,res) => {
    throw new Error('아직 구현되지 않았습니다.');
});

app.delete('/posts/:postId',
    requireLogin,
    async (req, res) => {
    try {
        if (!req.user || !('username' in req.user) || req.user.username === undefined || req.user.username === null) {
            throw new Error('로그인이 필요합니다.');
        }
        const post = await postsRepository.getPost(String(req.params.postId));
        if (!post) {
            throw new Error('게시글을 찾을 수 없습니다.');
        }
        if (post.createdBy !== req.user.username) {
            throw new Error('자신의 게시글만 삭제할 수 있습니다.');
        }
        await postsRepository.deletePost(String(req.params.postId));
        res.redirect(303, '/posts');
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


// 에러 핸들링
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 서버 콘솔에는 상세한 오류 정보 로그
    console.error('서버 에러 발생:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // 클라이언트에는 일반적인 에러 메시지만 전송
    res.status(500).json({
        error: '서버 내부 오류가 발생했습니다.',
        message: '잠시 후 다시 시도해주세요.'
    });
});

// 아무 경로에도 걸리지 않았으면 404 에러를 반환한다.
app.use((req: express.Request, res: express.Response) => {
    console.log('404 에러:', req.url, req.method);
    res.status(404).json({
        error: '요청하신 페이지를 찾을 수 없습니다.',
        message: 'URL을 확인해주세요.'
    });
});

app.listen(port);
