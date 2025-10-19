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
            const postId = post.querySelector('a').href.split('/').pop();
            this.loadedPostIds.add(postId);
        });

        window.addEventListener('scroll', () => this.handleScroll()); // handler 내부에서 클래스 인스턴스 this 에 접근 가능하도록 arrow function으로 감싼다
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
        
        const formattedDate = new Date(post.timestamp).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 게시글 데이터를 템플릿에 업데이트한다.
        const titleLink = article.querySelector('.post-title a');
        const timeElement = article.querySelector('time');
        const authorSpan = article.querySelector('.post-author');

        if (titleLink) {
            titleLink.href = `/posts/${post.id}`;
            titleLink.textContent = post.title;
        }

        if (timeElement) {
            timeElement.setAttribute('datetime', post.timestamp);
            timeElement.textContent = formattedDate;
        }

        if (authorSpan) {
            authorSpan.textContent = `등록: ${post.createdBy}`;
        }

        return article;
    }

    async handleScroll() {
        if (this.isLoading || !this.hasMore) return;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // 스크롤이 200px 남았으면 더 많은 추천 게시글을 불러온다.
        if (scrollTop + windowHeight >= documentHeight - 200) {
            await this.loadMorePosts();
        }
    }

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

document.addEventListener('DOMContentLoaded', function() {

    if (document.querySelector('.posts-list')) {
        new InfiniteScrollFeedController();
    }

});