/**
 * EdTech Quiz Logic Controller (Hỗ trợ Trắc nghiệm, Tự luận dài & Điền từ ngắn)
 */

const FIREBASE_URL = "https://ontap-59972-default-rtdb.firebaseio.com/quizStats.json";

document.addEventListener("DOMContentLoaded", () => {
    let questions = [];
    let startTime = null;
    let timerInterval = null;

    const loadingSection = document.getElementById('loading-section');
    const quizSection = document.getElementById('quiz-section');
    const resultSection = document.getElementById('result-section');
    const questionsContainer = document.getElementById('questions-container');
    const quizForm = document.getElementById('quiz-form');
    const timerDisplay = document.getElementById('timer-display');
    const timeSpan = timerDisplay.querySelector('span');
    const reviewContainer = document.getElementById('review-container');
    const attemptsSpan = document.querySelector('#attempts-display span');

    init();

    async function init() {
        try {
            fetchGlobalAttempts();
            const rawData = await fetchQuizData('data.txt');
            questions = parseData(rawData);
            startQuiz();
        } catch (error) {
            loadingSection.innerHTML = `<p style="color:red;">Lỗi tải dữ liệu: ${error.message}</p>`;
        }
    }

    async function fetchQuizData(url) {
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(url + cacheBuster);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
    }

    async function fetchGlobalAttempts() {
        try {
            const response = await fetch(FIREBASE_URL);
            const data = await response.json();
            attemptsSpan.textContent = (data && data.totalAttempts) ? data.totalAttempts : 0;
        } catch (error) {
            console.error("Lỗi đồng bộ Firebase:", error);
            attemptsSpan.textContent = "Lỗi";
        }
    }

    async function incrementGlobalAttempts() {
        try {
            const response = await fetch(FIREBASE_URL);
            let data = await response.json();
            let currentTotal = (data && data.totalAttempts) ? data.totalAttempts : 0;
            currentTotal += 1;

            await fetch(FIREBASE_URL, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalAttempts: currentTotal })
            });
            attemptsSpan.textContent = currentTotal;
        } catch (error) {
            console.error("Lỗi cập nhật Firebase:", error);
        }
    }

    function parseData(text) {
        const lines = text.split('\n');
        const parsedQuestions = [];
        let currentQ = null;

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            let qMatch = line.match(/^Ask\d+:\s*(.*)/i);
            if (qMatch) {
                if (currentQ) parsedQuestions.push(currentQ);
                currentQ = { questionText: qMatch[1], options: [], rawKey: null, type: 'single' };
                return;
            }

            let tMatch = line.match(/^Type:\s*(.*)/i);
            if (tMatch && currentQ) {
                currentQ.type = tMatch[1].toLowerCase().trim();
                return;
            }

            let aMatch = line.match(/^answer\d+:\s*(.*)/i);
            if (aMatch && currentQ) {
                currentQ.options.push(aMatch[1]);
                return;
            }

            let kMatch = line.match(/^Key:\s*(.*)/i);
            if (kMatch && currentQ) {
                currentQ.rawKey = kMatch[1];
            }
        });
        if (currentQ) parsedQuestions.push(currentQ);

        parsedQuestions.forEach(q => {
             if (q.type === 'essay' || q.type === 'short') {
                 q.key = q.rawKey; // Lưu nguyên chuỗi
             } else {
                 if (q.rawKey && q.rawKey.includes(',')) {
                     q.type = 'multi';
                     q.key = q.rawKey.split(',').map(Number);
                 } else if (q.rawKey) {
                     q.key = parseInt(q.rawKey, 10);
                 }
             }
        });

        return parsedQuestions;
    }

    function startQuiz() {
        renderQuestions();
        loadingSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        quizSection.classList.remove('hidden');
        
        quizForm.reset();
        startTime = Date.now();
        timerDisplay.classList.remove('hidden');
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function renderQuestions() {
        questionsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        questions.forEach((q, qIndex) => {
            const block = document.createElement('div');
            block.className = 'question-block';

            const title = document.createElement('div');
            title.className = 'question-text';
            title.textContent = `Câu ${qIndex + 1}: ${q.questionText}`;
            if (q.type === 'multi') title.textContent += ' (Có thể chọn nhiều đáp án)';
            if (q.type === 'essay') title.textContent += ' (Tự luận mở rộng)';
            // Điền từ ngắn không cần ghi chú thêm
            
            block.appendChild(title);

            const optionsGroup = document.createElement('div');
            optionsGroup.className = 'options-group';

            if (q.type === 'essay') {
                const textarea = document.createElement('textarea');
                textarea.name = `question_${qIndex}`;
                textarea.className = 'essay-input';
                textarea.placeholder = 'Nhập câu trả lời của bạn vào đây...';
                optionsGroup.appendChild(textarea);
            } else if (q.type === 'short') {
                // TẠO Ô NHẬP ĐIỀN TỪ NGẮN
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `question_${qIndex}`;
                input.className = 'short-input';
                input.placeholder = 'Nhập đáp án...';
                input.autocomplete = "off"; // Tắt gợi ý từ trình duyệt để chống gian lận
                optionsGroup.appendChild(input);
            } else {
                q.options.forEach((optText, optIndex) => {
                    const label = document.createElement('label');
                    label.className = 'option-label';

                    const input = document.createElement('input');
                    input.type = q.type === 'single' ? 'radio' : 'checkbox';
                    input.name = `question_${qIndex}`;
                    input.value = optIndex + 1;

                    label.appendChild(input);
                    label.appendChild(document.createTextNode(` ${optText}`));
                    optionsGroup.appendChild(label);
                });
            }

            block.appendChild(optionsGroup);
            fragment.appendChild(block);
        });
        questionsContainer.appendChild(fragment);
    }

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        timeSpan.textContent = `${m}:${s}`;
    }

    quizForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearInterval(timerInterval);
        timerDisplay.classList.add('hidden');
        
        await incrementGlobalAttempts();

        const timeTakenMs = Date.now() - startTime;
        evaluateResults(timeTakenMs);
    });

    function evaluateResults(timeTakenMs) {
        let correctCount = 0;
        let objectiveCount = 0; // Đếm số câu có thể tự động chấm (single, multi, short)
        const formData = new FormData(quizForm);
        reviewContainer.innerHTML = '';
        const reviewFragment = document.createDocumentFragment();

        questions.forEach((q, qIndex) => {
            if (q.type === 'essay') {
                const reviewItem = buildReviewItem(q, qIndex, null, formData);
                reviewFragment.appendChild(reviewItem);
            } else {
                objectiveCount++;
                const isCorrect = checkAnswer(q, qIndex, formData);
                if (isCorrect) correctCount++;
                const reviewItem = buildReviewItem(q, qIndex, isCorrect, formData);
                reviewFragment.appendChild(reviewItem);
            }
        });

        reviewContainer.appendChild(reviewFragment);

        const accuracy = objectiveCount > 0 ? Math.round((correctCount / objectiveCount) * 100) : 0;
        const m = String(Math.floor(timeTakenMs / 60000)).padStart(2, '0');
        const s = String(Math.floor((timeTakenMs % 60000) / 1000)).padStart(2, '0');

        document.getElementById('score-display').textContent = `${correctCount}/${objectiveCount}`;
        document.getElementById('accuracy-display').textContent = `${accuracy}%`;
        document.getElementById('time-display').textContent = `${m}:${s}`;

        quizSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    function checkAnswer(q, qIndex, formData) {
        if (q.type === 'single') {
            const selected = formData.get(`question_${qIndex}`);
            return selected && parseInt(selected, 10) === q.key;
        } else if (q.type === 'multi') {
            const selectedArr = formData.getAll(`question_${qIndex}`).map(Number);
            let isMatch = true;
            q.key.forEach((val, idx) => {
                if (selectedArr.includes(idx + 1) !== (val === 1)) isMatch = false;
            });
            return isMatch;
        } else if (q.type === 'short') {
            // LOGIC CHẤM ĐIỂM CÂU ĐIỀN TỪ: KHÔNG PHÂN BIỆT HOA THƯỜNG
            const selected = formData.get(`question_${qIndex}`);
            if (!selected) return false;
            // Loại bỏ khoảng trắng 2 đầu và chuyển về chữ thường
            const userAnswer = selected.trim().toLowerCase();
            const correctAnswer = q.key.trim().toLowerCase();
            return userAnswer === correctAnswer;
        }
        return false;
    }

    function buildReviewItem(q, qIndex, isCorrect, formData) {
        const div = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = `Câu ${qIndex + 1}: ${q.questionText}`;
        div.appendChild(title);

        if (q.type === 'essay') {
            div.className = 'review-item review-essay';
            const feedback = document.createElement('p');
            feedback.className = 'feedback-text feedback-essay';
            feedback.textContent = 'Trạng thái: Cần giáo viên chấm điểm';
            div.appendChild(feedback);

            const userAnswer = formData.get(`question_${qIndex}`);
            const userAnsDiv = document.createElement('div');
            userAnsDiv.style.marginTop = '10px';
            userAnsDiv.innerHTML = `<strong>Bài làm của bạn:</strong><br/>
                <div style="background: #fff; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 5px; white-space: pre-wrap;">${userAnswer || '<i>(Bỏ trống)</i>'}</div>`;
            div.appendChild(userAnsDiv);

            const correctInfo = document.createElement('div');
            correctInfo.style.marginTop = '15px';
            correctInfo.innerHTML = `<strong>Đáp án gợi ý:</strong><br/>
                <div style="background: #f0fdf4; padding: 10px; border: 1px solid #bbf7d0; border-radius: 4px; margin-top: 5px; white-space: pre-wrap; color: #166534;">${q.key || 'Không có gợi ý'}</div>`;
            div.appendChild(correctInfo);

        } else {
            div.className = `review-item ${isCorrect ? 'review-correct' : 'review-incorrect'}`;
            const feedback = document.createElement('p');
            feedback.className = `feedback-text ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
            feedback.textContent = isCorrect ? '✓ Chính xác' : '✗ Chưa chính xác';
            div.appendChild(feedback);

            const correctInfo = document.createElement('p');
            correctInfo.style.marginTop = '10px';
            correctInfo.style.fontSize = '0.9rem';
            
            if (q.type === 'single') {
                correctInfo.textContent = `Đáp án đúng: ${q.options[q.key - 1]}`;
            } else if (q.type === 'multi') {
                const correctOpts = q.key.map((val, idx) => val === 1 ? q.options[idx] : null).filter(v => v !== null);
                correctInfo.textContent = `Đáp án đúng: ${correctOpts.join(', ')}`;
            } else if (q.type === 'short') {
                // Hiển thị cả đáp án đúng và đáp án học sinh vừa nhập
                const userAnswer = formData.get(`question_${qIndex}`) || 'Bỏ trống';
                correctInfo.innerHTML = `<strong>Đáp án đúng:</strong> ${q.key} <br/><span style="color:var(--text-muted)">Bạn đã nhập: ${userAnswer}</span>`;
            }
            div.appendChild(correctInfo);
        }

        return div;
    }

    document.getElementById('retake-btn').addEventListener('click', () => {
        startQuiz();
        fetchGlobalAttempts(); 
    });
});
