export function logUserVisitedPost(postId) {
    
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