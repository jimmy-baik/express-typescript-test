
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

// Event 붙이기
document.addEventListener('DOMContentLoaded', function() {
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
        button.addEventListener('click', function() {
            const postId = e.target.getAttribute('data-post-id');
            toggleLike(postId);
        });
    });
});
