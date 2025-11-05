class InfiniteScrollFeedController {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.loadedPostIds = new Set();
        this.postsContainer = document.querySelector('.posts-list');
        this.loadingIndicator = this.createLoadingIndicator();
        
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
        const formattedDate = new Date(post.timestamp).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
        });

        // 본문 미리보기 포맷팅
        const contentPreview = post.content 
            ? (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
            : '설명 없음';

        // 게시글 데이터를 템플릿에 업데이트한다.
        const authorName = article.querySelector('.post-author-info .author-name');
        const titleLink = article.querySelector('.post-title a');
        const subtitleDiv = article.querySelector('.post-subtitle');
        const dateSpan = article.querySelector('.post-meta .meta-item span');
        const heartIcon = article.querySelector('.heart-icon');

        // 글쓴이 설정
        if (authorName) {
            authorName.textContent = post.createdBy;
        }

        // 제목 링크 설정
        if (titleLink) {
            titleLink.href = post.sourceUrl || `/posts/${post.id}`;
            titleLink.textContent = post.title;
            titleLink.setAttribute('data-post-id', post.id);
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
            heartIcon.setAttribute('data-post-id', post.id);
        }

        return article;
    }

    // async handleScroll() {
    //     if (this.isLoading || !this.hasMore) return;

    //     const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    //     const windowHeight = window.innerHeight;
    //     const documentHeight = document.documentElement.scrollHeight;

    //     // 스크롤이 200px 남았으면 더 많은 추천 게시글을 불러온다.
    //     if (scrollTop + windowHeight >= documentHeight - 200) {
    //         await this.loadMorePosts();
    //     }
    // }

    async loadMorePosts() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        this.showLoadingIndicator();

        try {
            const excludeIds = Array.from(this.loadedPostIds);
            const response = await fetch(
                `/api/posts/recommendations?page=${this.currentPage}&limit=5&exclude=${excludeIds.join(',')}`
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
            if (!this.loadedPostIds.has(post.id)) {
                const postElement = this.createPostElement(post);
                this.postsContainer.appendChild(postElement);
                this.loadedPostIds.add(post.id);
            }
        });
    }

    showLoadingIndicator() {
        this.loadingIndicator.style.display = 'block';
        this.postsContainer.appendChild(this.loadingIndicator);
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

function logUserVisitedPost(postId) {
    
    fetch(`/api/posts/${postId}/viewed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('게시글 열람이력 추적에 실패했습니다.');
        }
    })
    .catch(error => {
        console.error('게시글 열람이력 기록 중 오류가 발생했습니다:', error);
    });
}

function deletePost(postId) {
    if (confirm('게시글을 삭제하시겠습니까?')) {
        fetch(`/posts/${postId}`, {
            method: 'DELETE',
            redirect: 'follow'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('삭제에 실패했습니다.');
                }

                if (response.redirected) {
                    window.location.href = response.url;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('삭제 중 오류가 발생했습니다.');
            });
    }
}

document.addEventListener('DOMContentLoaded', function() {

    const postsList = document.querySelector('.posts-list');
    const scrollTarget = document.querySelector('#scroll-target');

    if (!postsList || !scrollTarget) {
        // posts-list 또는 scroll-target 엘리먼트가 없으면 무한 스크롤을 사용하지 않는다.
        return;
    }
    
    // 무한 스크롤 컨트롤러를 intersection observer에 연결한다.
    const feedController = new InfiniteScrollFeedController();
    const scrollObserver = new IntersectionObserver((entries) => {
        // entry가 한 개일 때를 가정한다. intersectionRatio가 0보다 작으면 무시한다.
        if (entries[0].intersectionRatio <= 0) {
            return;
        }

        // intersection ratio가 0보다 크면 더 많은 추천 게시글을 불러온다.
        feedController.loadMorePosts();
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

});

s