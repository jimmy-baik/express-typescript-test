# Smallfeed

Smallfeed는 소규모 팀이나 커뮤니티가 서로 발견한 아티클·영상·뉴스를 깔끔하고 안전하게 공유하기 위해 시작한 프로젝트다. 누구나 초대 기반의 비공개 피드를 만들고, 링크 하나만으로 콘텐츠를 가져와 자동 요약과 추천까지 받을 수 있는 개인화된 공동 큐레이션 공간을 목표로 한다.

## 우리가 풀고 있는 문제와 접근
1. **초대 기반 공동 피드 운영**
   - 문제: 메신저나 DM으로 흩어지는 링크를 정돈하면서도 외부 노출을 최소화하고 싶었다.
   - 접근: `feeds`, `feed_members`, `feed_invites` 테이블과 `requireFeedMembership` 미들웨어로 슬러그 단위의 접근 제어를 구현했다. 초대 토큰은 7일 만료·비활성화를 지원해 링크 공유를 제어한다.
   - 장점: 초대 링크만으로 온보딩이 빠르고, 단일 미들웨어로 API·뷰 모두를 보호할 수 있다.  
     단점: 역할 기반 권한이 아직 없어 운영자가 모든 멤버를 관리해야 한다.

2. **다양한 콘텐츠 소스 통합 수집**
   - 문제: 웹 기사, YouTube, RSS 등 포맷마다 파싱 방식이 달라 일관된 저장·요약이 어려웠다.
   - 접근: `contentExtractionService`가 URL을 분석해 RSS 전체 수집, YouTube 트랜스크립트, 일반 웹 문서를 각각 다른 파이프라인으로 처리한다. `@extractus/article-extractor`, `youtube-transcript-plus`, Gemini API를 이용해 텍스트화·요약·embedding을 동시에 만든다.
   - 장점: 한 번의 제출로 중복 검사→추출→요약→embedding→피드 연결까지 자동화된다.  
     단점: 외부 API 의존성과 속도·비용 문제가 있어 실패 시 재시도 로직이 필요하다.

3. **검색과 개인화 추천 품질**
   - 문제: 단순 최신순 정렬만으로는 멤버마다 다른 관심사를 반영하기 어렵다.
   - 접근: OpenSearch에 `generatedSummary`, `textContent`, `embedding`을 색인하고, `searchService`가 키워드·벡터 혼합 전략을 순차적으로 시도한다. 사용자의 조회/좋아요 기록을 `embeddingsService`가 평균·가중치 방식으로 user embedding으로 환원해 추천에 활용한다.
   - 장점: 컨텐츠가 적을 때는 키워드 검색으로, 많아지면 벡터 기반 추천으로 자연스럽게 전환된다.  
     단점: OpenSearch 클러스터가 필요하고, 충분한 인터랙션 데이터가 쌓이기 전엔 추천 품질이 제한적이다.

## 데이터 모델 한눈에 보기
주요 테이블과 관계는 다음과 같다.

```
users ──< feed_members >── feeds ──< feed_posts >── posts
   │                         │
   │                         └─< feed_invites
   └─< user_post_interactions >── posts

feeds ──< feed_ingestion_sources >── ingestion_sources
```

- `users`: 로컬·카카오 인증을 모두 수용하며, `userEmbedding` 필드에 개인화 벡터를 JSON으로 저장한다.
- `feeds`: 슬러그 기반 URL과 소유자 정보를 보유한다.
- `feed_members`: 피드별 멤버십을 정의하는 다대다 조인.
- `posts`: 추출된 원문, 요약(`generatedSummary`), embedding을 저장하고 중복 URL을 방지한다.
- `feed_posts`: 하나의 원본 포스트를 여러 피드가 공유할 수 있도록 연결하며, 제출자와 시간을 기록한다.
- `feed_invites`, `feed_ingestion_sources`: 초대 토큰, RSS 같은 자동 수집 소스를 관리한다.
- `user_post_interactions`: 좋아요·열람 기록을 남겨 추천 학습에 활용한다.

## 사용 기술
- **Backend**: Express 5, TypeScript, EJS 뷰, Passport(Local/Kakao), Helmet.
- **Data & Infra**: SQLite/Turso + Drizzle ORM, OpenSearch (키워드·벡터 검색), Express Session.
- **AI & 콘텐츠 처리**: Google Gemini API, `@extractus/article-extractor`, `youtube-transcript-plus`, `rss-parser`, `string-strip-html`.
- **구조**: 헥사고날 스타일로 `adapters/primary`(HTTP)와 `adapters/secondary`(DB·LLM·OpenSearch), 서비스 계층(`services/*`), 레포지토리(`repositories/*`)로 분리.

## Getting Started
1. **필수 요건**
   - Node.js 20 이상, npm
   - SQLite 파일 또는 LibSQL/Turso 호스트
   - 실행 중인 OpenSearch 2.x 이상 (개발용: `docker run opensearchproject/opensearch:2`)

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정** – `.env` 또는 셸에 다음을 정의한다.
   - `DB_URL`: 예) `file:./dev.db` 또는 `libsql://<turso-url>`
   - `SESSION_SECRET_KEY`
   - `CURRENT_SERVER_ROOT_URL`: 예) `http://localhost:3002`
   - `KAKAO_APP_KEY` (선택)
   - `GEMINI_API_KEY`, `EMBEDDING_API_URL`
   - `OPENSEARCH_URL`, `OPENSEARCH_ID`, `OPENSEARCH_PW`

4. **데이터베이스 초기화**
   ```bash
   npx drizzle-kit migrate
   ```

5. **개발 서버 실행**
   ```bash
   npm start
   ```
   서버는 기본적으로 `http://localhost:3002`에서 동작한다.

6. **테스트 실행 (선택)**
   ```bash
   npm test
   ```

환경을 기동한 뒤 `/feeds`로 이동하면 로그인 후 초대 기반 피드를 만들고, URL을 제출해 요약·추천 흐름을 바로 확인할 수 있다.
