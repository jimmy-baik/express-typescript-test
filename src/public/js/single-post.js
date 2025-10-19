
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

function toggleLike(postId) {
    const likeBtnTop = document.getElementById('likeBtnTop');
    const likeBtnBottom = document.getElementById('likeBtnBottom');
    const heartIconTop = likeBtnTop.querySelector('.heart-icon');
    const heartIconBottom = likeBtnBottom.querySelector('.heart-icon');

    fetch(`/posts/${postId}/like`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            if (response.ok) {
                likeBtnTop.classList.toggle('liked');
                likeBtnBottom.classList.toggle('liked');

                if (likeBtnTop.classList.contains('liked')) {
                    heartIconTop.textContent = '♥';
                    heartIconBottom.textContent = '♥';
                } else {
                    heartIconTop.textContent = '♡';
                    heartIconBottom.textContent = '♡';
                }
            } else {
                throw new Error('좋아요 처리에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}


// 게시글 열람이력 추적
let hasTrackedView = false;
let timeTrackingStarted = false;
let timeTrackingTimer = null;

function sendTrackPostViewRequest(postId) {
    if (hasTrackedView) {
        return; // 이미 기록이 전송된적이 있다면 아무것도 하지 않는다.
    }
    
    hasTrackedView = true;
    
    fetch(`/posts/${postId}/viewed`, {
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

function startTimeTracking(postId) {
    // 사용자가 한 페이지에서 N초 이상 아티클을 열람했다면 사용자 선호도를 기록
    if (timeTrackingStarted) {
        return;
    }
    
    timeTrackingStarted = true;
    timeTrackingTimer = setTimeout(() => {
        sendTrackPostViewRequest(postId);
    }, 30000); // 30초
}

function checkScrollPosition(postId) {
    // 사용자가 특정 기준 이상 스크롤 했다면 사용자 선호도를 기록

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercentage = scrollTop / documentHeight;
    
    if (scrollPercentage >= 0.33) { // 1/3 of the page
        sendTrackPostViewRequest(postId);
    }
}

// Event 붙이기
document.addEventListener('DOMContentLoaded', function() {

    const postId = document.querySelector('[data-post-id]')?.getAttribute('data-post-id');    
    if (postId) {
        // 열람 시간 추적 시작
        startTimeTracking(postId);
        
        // 스크롤 추적 이벤트 리스너 시작
        window.addEventListener('scroll', function() {
            if (!hasTrackedView) {
                checkScrollPosition(postId);
            }
        });
    }
    
    // 삭제 버튼 이벤트 리스너
    const deleteBtn = document.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const postId = e.target.getAttribute('data-post-id');
            deletePost(postId);
        });
    }

    // 좋아요 버튼 이벤트 리스너
    const likeButtons = document.querySelectorAll('.like-btn');
    likeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const postId = e.target.getAttribute('data-post-id');
            toggleLike(postId);
        });
    });
});
