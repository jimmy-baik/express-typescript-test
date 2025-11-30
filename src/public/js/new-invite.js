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
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            copyToClipboard();
        });
    }
});