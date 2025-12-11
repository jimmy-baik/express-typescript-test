import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import helmet from 'helmet';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import db from '@adapters/secondary/db/client';
import { UserRepository } from '@repositories/userRepository';
import { initializeOpenSearch } from '@adapters/secondary/opensearch';
import { initializeSearchEngine } from '@adapters/secondary/searchengine/searchEngineFactory';

// View 경로 (HTML 웹페이지를 반환)
import authViewRouter from '@adapters/primary/routes/auth/authViewRouter';
import feedsViewRouter from '@adapters/primary/routes/feeds/feedsViewRouter';

// API 경로 (JSON 응답을 반환)
import authApiRouter from '@adapters/primary/routes/auth/authApiRouter';
import feedsApiRouter from '@adapters/primary/routes/feeds/feedsApiRouter';
import postsApiRouter from '@adapters/primary/routes/posts/postsApiRouter';


// 환경변수 불러오기
dotenv.config();

const app = express();
const port = 3002;


// 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//정적파일 설정
app.use(express.static(
    path.join(__dirname, 'public'),
    {
        maxAge: '1d',
        lastModified: true
    }
));

// 미들웨어 설정

// 요청 body 해석
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 보안 헤더 설정
app.use(helmet());

// 세션 설정
const sessionSecretKey = process.env.SESSION_SECRET_KEY;
if (sessionSecretKey === undefined) {
    throw new Error('SESSION_SECRET_KEY 환경변수가 설정되지 않았습니다. .env 파일에서 설정해주세요.');
}
app.use(session({
    secret: sessionSecretKey,
    resave: false,
    saveUninitialized: false
}));

// 검색엔진 초기화
initializeSearchEngine().catch((err) => {
    console.error('검색엔진 초기화 실패:', err);
});

// 유저 Repository 설정
const usersRepository = new UserRepository(db);


// passport 설정
app.use(passport.initialize());
app.use(passport.session());

// passport local strategy 설정 - 지금은 사용하지 않음
// passport.use(new LocalStrategy({
//     usernameField: 'username',
//     passwordField: 'password'
// }, async (username, password, done) => { // verify 함수
//     try {

//         const user = await usersRepository.getUserByUsername(username);
//         if (!user) {
//             return done(null, false);
//         }

//         const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
//         if (!isPasswordValid) {
//             return done(null, false);
//         }

//         return done(null, user);

//     } catch (err) {
//         return done(err);
//     }
// }));

// passport kakao strategy 설정
const KAKAO_CALLBACK_URL = process.env.CURRENT_SERVER_ROOT_URL + '/api/auth/kakao/callback';
passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_APP_KEY || '',
    clientSecret: process.env.KAKAO_APP_CLIENT_SECRET || '',
    callbackURL: KAKAO_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await usersRepository.getUserByUsername(profile.id);
        if (user) {
            // 사용자가 있으면 바로 반환
            return done(null, user);
        } else {
            // 사용자가 없으면 새로 생성 후 반환
            const newUser = await usersRepository.createUser(profile.id, String(randomUUID()), null);
            return done(null, newUser);
        }
    } catch (err) {
        return done(err);
    }
}));


passport.serializeUser((user, done) => {
    if ('userId' in user && user.userId !== undefined) {
        done(null, user.userId);
    } else {
        done(new Error('정상적인 User 객체가 아닙니다.'));
    }
});

passport.deserializeUser(async (userId: number, done) => {
    try {
        const user = await usersRepository.getUser(userId);
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        done(null, user);
    } catch (err) {
        done(err);
    }
});

// View 경로 등록
app.use('/', authViewRouter);
app.use('/feeds', feedsViewRouter);


// API 경로 등록
app.use('/api/auth', authApiRouter);
app.use('/api/feeds', feedsApiRouter);
app.use('/api/posts', postsApiRouter);

// users API는 지금은 사용하지 않음
// app.use('/api/users', usersApiRouter);


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
    console.log(`서버 구동 중 - port ${port}`);
	app.listen(port);
}

export default app;