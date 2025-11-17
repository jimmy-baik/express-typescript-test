const KST_TIMEZONE_OFFSET = 9 * 3600 * 1000; // utc + 9시간 (3600초 * 1000밀리초)

export function UtcToKst(utcDate: Date): Date {
    return new Date(utcDate.getTime() + KST_TIMEZONE_OFFSET);
}

export function KstToUtc(kstDate: Date): Date {
    return new Date(kstDate.getTime() - KST_TIMEZONE_OFFSET);
}

export function getUnixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

export function dateToUnixTimestamp(date: Date): number {
    return Math.floor(date.getTime() / 1000);
}

export function unixTimestampToDate(unixTimestamp: number): Date {
    return new Date(unixTimestamp * 1000);
}
