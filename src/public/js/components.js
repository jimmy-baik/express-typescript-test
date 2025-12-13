class CustomNavbar extends HTMLDivElement {
    constructor() {
        super();
        this.feedSlug = this.getAttribute('data-feed-slug') || null;
    }

    connectedCallback() {
        this.render(this.feedSlug);
    }

    render(feedSlug=null) {

        const renderRoot = document.createElement('div');
        renderRoot.classList.add('header-content');
        renderRoot.innerHTML = `
            <div class="header-left">
                <a class="home-link" href="/feeds">
                    <svg class="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"></path>
                    </svg>
                </a>
            </div>
        `;

        if (feedSlug && feedSlug !== '') {
            const searchContainer = document.createElement('div');
            searchContainer.classList.add('search-container');
            searchContainer.innerHTML = `
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <form method="GET" action="/feeds" style="display: contents;">
                    <input type="text" name="q" class="search-input" placeholder="검색" />
                    <input type="hidden" name="feed" value="${feedSlug}" />
                </form>
            `;
            renderRoot.appendChild(searchContainer);

            const headerRight = document.createElement('div');
            headerRight.classList.add('header-right');
            headerRight.innerHTML = `
                <a href="/feeds" class="add-content-btn">
                    <svg class="people-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    초대
                </a>
                <a href="/feeds" class="add-content-btn">
                    <svg class="add-content-btn-icon" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    컨텐츠 추가
                </a>
            `;
            renderRoot.appendChild(headerRight);
        }

        this.appendChild(renderRoot);

    }
}

customElements.define('custom-navbar', CustomNavbar, { extends: "div" });