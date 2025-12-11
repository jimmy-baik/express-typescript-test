import { logUserVisitedPost } from './user-engagements.mjs';

class InfiniteScrollFeedController {
    constructor(feedSlug) {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.loadedPostIds = new Set();
        this.postsContainer = document.querySelector('.posts-list');
        this.loadingIndicator = this.createLoadingIndicator();
        this.feedSlug = feedSlug;
        
        this.init();
    }

    init() {
        const existingPosts = document.querySelectorAll('.post-item');
        existingPosts.forEach(post => {
            const postId = post.querySelector('a[data-post-id]').getAttribute('data-post-id');
            this.loadedPostIds.add(postId);
        });
    }

    createLoadingIndicator() {
        // 로딩 템플릿을 가져온다.
        const template = document.getElementById('loading-template');
        if (!template) {
            console.error('로딩 템플릿을 찾을 수 없습니다.');
            // fallback
            const indicator = document.createElement('div');
            indicator.className = 'loading-indicator';
            indicator.innerHTML = '<div class="spinner"></div><p>더 많은 추천 게시글을 불러오는 중...</p>';
            indicator.style.display = 'none';
            return indicator;
        }

        // 템플릿을 복제한다.
        const indicator = template.content.cloneNode(true);
        indicator.querySelector('.loading-indicator').style.display = 'none';
        return indicator.querySelector('.loading-indicator');
    }

    createPostElement(post) {
        // 게시글 row 템플릿을 가져온다.
        const template = document.getElementById('post-template');
        if (!template) {
            console.error('Post template not found');
            return document.createElement('div');
        }

        // 템플릿을 복제한다.
        const article = template.content.cloneNode(true);
        
        // 날짜 포맷팅
        const formattedDate = new Date(post.submittedAt).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
        });

        // 본문 미리보기 포맷팅
        const contentPreview = post.textContent 
            ? (post.textContent.length > 150 ? post.textContent.substring(0, 150) + '...' : post.textContent)
            : '설명 없음';

        // 게시글 데이터를 템플릿에 업데이트한다.
        // const authorName = article.querySelector('.post-author-info .author-name');
        const titleLink = article.querySelector('.post-title a');
        const subtitleDiv = article.querySelector('.post-subtitle');
        const dateSpan = article.querySelector('.post-meta .meta-item span');
        const heartIcon = article.querySelector('.heart-icon');

        // // 글쓴이 설정
        // if (authorName) {
        //     authorName.textContent = post.createdBy;
        // }

        // 제목 링크 설정
        if (titleLink) {
            titleLink.href = post.originalUrl || `/posts/${post.postId}`;
            titleLink.textContent = post.title;
            titleLink.setAttribute('data-post-id', post.postId);
        }

        // 본문 미리보기 설정
        if (subtitleDiv) {
            subtitleDiv.textContent = contentPreview;
        }

        // 날짜 설정
        if (dateSpan) {
            dateSpan.textContent = formattedDate;
        }

        // 좋아요 버튼 data-post-id 설정
        if (heartIcon) {
            heartIcon.setAttribute('data-post-id', post.postId);
        }

        // 아코디언 설정 (summary가 있는 경우)
        if (post.generatedSummary) {
            const accordionSection = article.querySelector('.accordion-section');
            const accordionSummary = article.querySelector('.accordion-summary');
            const viewFullBtn = article.querySelector('.view-full-btn');
            
            if (accordionSection) {
                accordionSection.setAttribute('data-post-id', post.postId);
            }
            
            if (accordionSummary) {
                accordionSummary.textContent = post.generatedSummary;
            }
            
            if (viewFullBtn && post.originalUrl) {
                viewFullBtn.href = post.originalUrl;
            }
        } else {
            // summary가 없으면 아코디언 섹션 제거
            const accordionSection = article.querySelector('.accordion-section');
            if (accordionSection) {
                accordionSection.remove();
            }
        }

        return article;
    }

    async loadMorePosts() {
        
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        this.showLoadingIndicator();

        try {
            if (!this.feedSlug) {
                console.error('feed 정보가 없습니다. 추천 게시글을 불러올 수 없습니다.');
                this.hasMore = false;
                return;
            }

            const excludeIds = Array.from(this.loadedPostIds);
            const response = await fetch(
                `/api/feeds/${this.feedSlug}/recommendations?limit=5&exclude=${excludeIds.join(',')}`
            );

            if (!response.ok) {
                throw new Error('Failed to load recommendations');
            }

            const data = await response.json();
            
            if (data.posts && data.posts.length > 0) {
                this.renderPosts(data.posts);
                this.currentPage++;
                this.hasMore = data.hasMore;
            } else {
                this.hasMore = false;
            }

        } catch (error) {
            console.error('추천 게시글을 불러오는데 실패했습니다. 오류:', error);
            this.showError('추천 게시글을 불러오는데 실패했습니다.');
        } finally {
            this.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    renderPosts(posts) {
        posts.forEach(post => {
            if (!this.loadedPostIds.has(post.postId)) {
                const postElement = this.createPostElement(post);
                this.postsContainer.appendChild(postElement);
                this.loadedPostIds.add(post.postId);
            }
        });
        // scrollTarget을 리스트의 마지막으로 이동
        this.moveScrollTargetToEnd();
    }

    moveScrollTargetToEnd() {
        const scrollTarget = document.querySelector('#scroll-target');
        if (scrollTarget && this.postsContainer) {

            // 맨 끝으로 이동 (appendChild는 자동으로 이동)
            this.postsContainer.appendChild(scrollTarget);
        }
    }

    showLoadingIndicator() {
        this.loadingIndicator.style.display = 'block';
        const scrollTarget = document.querySelector('#scroll-target');
        if (scrollTarget && scrollTarget.parentNode === this.postsContainer) {
            // scrollTarget 앞에 로딩 인디케이터 삽입
            this.postsContainer.insertBefore(this.loadingIndicator, scrollTarget);
        } else {
            // scrollTarget이 없으면 맨 끝에 추가
            this.postsContainer.appendChild(this.loadingIndicator);
        }
    }

    hideLoadingIndicator() {
        this.loadingIndicator.style.display = 'none';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #dc3545;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            margin: 20px 0;
        `;
        this.postsContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
}

function toggleLike(postId, heartIcon) {
    fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (response.ok) {
                heartIcon.classList.toggle('liked');
                // fill 속성도 업데이트
                if (heartIcon.classList.contains('liked')) {
                    heartIcon.setAttribute('fill', 'currentColor');
                } else {
                    heartIcon.setAttribute('fill', 'none');
                }
            } else {
                throw new Error('좋아요 처리에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}


function toggleAccordion(clickedAccordion) {    
    // 클릭된 아코디언을 토글한다
    clickedAccordion.classList.toggle('expanded');
}

function copyToClipboard() {

    const inviteUrl = document.getElementById('inviteUrl').value;

    const copyBtn = document.getElementById('copyBtn');
    
    navigator.clipboard.writeText(inviteUrl).then(function() {
        // 복사 성공 시 버튼 텍스트 변경
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '복사됨!';
        copyBtn.classList.remove('not-copied');
        copyBtn.classList.add('copied');
        
        // 2초 후 원래 텍스트로 복원
        setTimeout(function() {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('copied');
            copyBtn.classList.add('not-copied');
        }, 2000);
    })
}

document.addEventListener('DOMContentLoaded', function() {

    const postsList = document.querySelector('.posts-list');
    const scrollTarget = document.querySelector('#scroll-target');

    if (!postsList || !scrollTarget) {
        // posts-list 또는 scroll-target 엘리먼트가 없으면 무한 스크롤을 사용하지 않는다.
        return;
    }


    const urlParams = new URLSearchParams(window.location.search);
    const userQuery = urlParams.get('q');
    if (userQuery) {
        // 검색어가 입력되어 있으면 무한스크롤을 시작하지 않는다 (검색결과만 보는 경우임)
        return;
    }

    
    // feedSlug를 content-container에서 가져온다.
    const contentContainer = document.querySelector('.content-container');
    const feedSlug = contentContainer ? contentContainer.getAttribute('data-feed-slug') : null;
    
    // 무한 스크롤 컨트롤러를 intersection observer에 연결한다.
    const feedController = new InfiniteScrollFeedController(feedSlug);
    
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // isIntersecting이 true이고 intersectionRatio가 0보다 크면 트리거
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
                feedController.loadMorePosts();
            }
        });
    },{
        rootMargin: '0px 0px 50px' // 상, 좌우, 하
    });
    scrollObserver.observe(scrollTarget);

    // 좋아요 버튼 클릭시 이벤트 리스너. 목록이 동적으로 바뀌므로 상위 요소에 리스너를 추가해서 위임한다.
    postsList.addEventListener('click', function(e) {
        // 클릭된 요소가 heart-icon이거나 그 자식인지 확인
        const heartIcon = e.target.closest('.heart-icon');
        if (heartIcon) {
            e.preventDefault();
            const postId = heartIcon.getAttribute('data-post-id');
            if (postId) {
                toggleLike(postId, heartIcon);
            }
        }
    });

    // 게시글 열람이력 추적
    postsList.addEventListener('click', function(e) {
        // 클릭된 요소가 data-post-id를 가진 링크인지 확인
        const postLink = e.target.closest('a[data-post-id]');
        if (postLink) {
            const postId = postLink.getAttribute('data-post-id');
            if (postId) {
                logUserVisitedPost(postId);
            }
        }
    });

    // 아코디언 토글 이벤트 리스너
    postsList.addEventListener('click', function(e) {
        // 클릭된 요소가 accordion-toggle 버튼이거나 그 자식인지 확인
        const accordionToggle = e.target.closest('.accordion-toggle');
        if (accordionToggle) {
            e.preventDefault();
            const accordionSection = accordionToggle.closest('.accordion-section');
            if (accordionSection) {
                toggleAccordion(accordionSection);
            }
        }
    });

    // 복사 버튼 클릭시 이벤트 리스너
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            copyToClipboard();
        });
    }

});