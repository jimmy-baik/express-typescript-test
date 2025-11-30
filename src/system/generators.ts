/**
 * 정해진 길이의 랜덤 문자열을 생성하는 helper 함수
 * @param length 문자열 길이
 * @returns 입력된 길이만큼의 랜덤 문자열
 */
export function generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}