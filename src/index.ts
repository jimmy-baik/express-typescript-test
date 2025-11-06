import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import helmet from 'helmet';
import path from 'node:path';
import { FilesystemUserRepository } from './repositories/userRepository';
import { initializeOpenSearch } from './adapters/opensearch';

// View 경로 (HTML 웹페이지를 반환)
import authViewRouter from './routers/auth/authViewRouter';
import postsViewRouter from './routers/posts/postsViewRouter';

// API 경로 (JSON 응답을 반환)
import authApiRouter from './routers/auth/authApiRouter';
import usersApiRouter from './routers/users/usersApiRouter';
import postsApiRouter from './routers/posts/postsApiRouter';
import searchApiRouter from './routers/search/searchApiRouter';

// 환경변수 불러오기
dotenv.config();

const app = express();
const port = 3002;


// 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//정적파일 설정
app.use(express.static(path.join(__dirname, 'public')));

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

// OpenSearch 초기화
initializeOpenSearch().catch((err) => {
    console.error('OpenSearch 초기화 실패:', err);
});

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

        const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
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

// 기본 라우트
app.get('/', (req, res) => {
    res.redirect('/posts');
});


// View 경로 (HTML 웹페이지를 반환)
app.use('/', authViewRouter);
app.use('/posts', postsViewRouter);


// API 경로 (JSON 응답)
app.use('/api/auth', authApiRouter);
app.use('/api/users', usersApiRouter);
app.use('/api/posts', postsApiRouter);
app.use('/api/search', searchApiRouter);


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

if (process.env.NODE_ENV !== 'test') {
	app.listen(3002);
}

export default app;