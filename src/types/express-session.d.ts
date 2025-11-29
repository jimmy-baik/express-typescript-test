import 'express-session';
import { User } from '@models/users';

declare module 'express-session' {
    interface SessionData {
        returnToUrl?: string; // 로그인 처리후 리다이렉트할 URL
    }
}