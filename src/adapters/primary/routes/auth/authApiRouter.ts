import express from 'express';
import passport from 'passport';
import { User } from '@models/users';

const router = express.Router();


// 로그인 처리후 어디로 이동할지 판단하여 redirect 경로를 반환하는 helper 함수
function getRedirectUrlAfterLogin(req: express.Request) {
    const returnToUrl = req.session.returnToUrl;
    if (returnToUrl) {
        // 저장되어 있던 경로의 리다이렉트가 처리되었으므로 returnToUrl 정보는 session에서 삭제한다.
        delete req.session.returnToUrl;
        return returnToUrl;
    }

    // 저장되어 있던 리다이렉트 경로가 없다면 기본 경로로 리다이렉트한다.
    return '/feeds';
}

// custom 리다이렉트 로직을 가지는 passport 콜백함수를 반환하는 factory 함수
function createPassportCustomCallbackFunction(req: express.Request, res: express.Response, next: express.NextFunction) {

    return (err: Error | null, user: User | false, info: any) => {
        // 로그인 처리 중 에러 발생 시 에러 반환
        if (err) {
            return next(err);
        }

        // 로그인 실패 시 로그인 페이지로 리다이렉트한다.
        if (!user) {
            return res.redirect('/login');
        }

        // 정상 처리시 저장되어 있던 리다이렉트 경로로 리다이렉트한다.
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }

            const redirectUrl = getRedirectUrlAfterLogin(req);
            return res.redirect(redirectUrl);
        });
    };

}



// 일반 로그인 처리 경로 - 지금은 사용하지 않음
// router.post('/login',
//     (req, res, next) => {
//         // custom redirect 로직을 가지는 passport 콜백함수를 생성한다.
//         const customCallback = createPassportCustomCallbackFunction(req, res, next);

//         // passport.authenticate 에 커스텀 콜백을 등록한뒤 바로 호출
//         passport.authenticate('local', customCallback)(req, res, next);
//     }
// );


// 카카오 로그인 처리 최초 진입 경로
router.get('/kakao', passport.authenticate('kakao'));


// 카카오 로그인 콜백 처리 경로
router.get('/kakao/callback', 
    (req, res, next) => {
        const customCallback = createPassportCustomCallbackFunction(req, res, next);
        passport.authenticate('kakao', customCallback)(req, res, next);
    }
);


export default router;
