import { MeilisearchAdapter} from "./meilisearch";
import { OpensearchAdapter } from "./opensearch";
import { ISearchEngine } from "./searchEngine.interface";

/**
 * 검색엔진을 받아가는 팩토리 함수. 환경변수에 선언되어있는 검색엔진 타입에 따라 검색엔진 인스턴스를 반환한다.
 * @param searchEngineType 검색엔진 타입 (meilisearch, opensearch)
 * @returns 검색엔진 인스턴스
 */
export function getSearchEngine(searchEngineType: string): ISearchEngine {
    switch (searchEngineType) {
        case "meilisearch":
            return new MeilisearchAdapter();
        case "opensearch":
            return new OpensearchAdapter();
        default:
            throw new Error(`지원되지 않는 검색엔진 타입입니다: ${searchEngineType}`);
    }
}

/**
 * 검색엔진 초기화 함수. 환경변수에 선언되어있는 검색엔진 타입에 따라 검색엔진을 초기화한다.
 */
export async function initializeSearchEngine() {
    const searchEngine = getSearchEngine(process.env.SEARCH_ENGINE_TYPE || "meilisearch");
    await searchEngine.initializeIndex();
}