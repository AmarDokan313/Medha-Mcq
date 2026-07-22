let currentSubject = '';
let currentChapter = null;
let currentQuestions = [];
let examQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let timerInterval = null;
let timeLeft = 1800;
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let adFreeUntil = parseInt(localStorage.getItem('adFreeUntil') || '0');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let totalPoints = parseInt(localStorage.getItem('totalPoints') || '0');

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    window.scrollTo(0, 0);
}

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            showPage('home-page');
            loadDarkMode();
            updateUserUI();
            updateLeaderboard();
        }, 300);
    }, 100);
});

function loadDarkMode() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function updateUserUI() {
    const loginBtn = document.querySelector('.login-btn');
    if (currentUser && loginBtn) {
        loginBtn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.name.split(' ')[0]}`;
    }
}

function showSubject(subjectKey) {
    currentSubject = subjectKey;

    if (!subjectData || !subjectData[subjectKey]) {
        showToast('এই বিষয়ের প্রশ্ন শীঘ্রই আসছে!');
        return;
    }

    const subject = subjectData[subjectKey];
    document.getElementById('subject-title').textContent = subject.name;

    const chaptersList = document.getElementById('chapters-list');
    chaptersList.innerHTML = '';

    if (!subject.chapters || subject.chapters.length === 0) {
        chaptersList.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><p>শীঘ্রই আসছে!</p></div>';
        showPage('subject-page');
        return;
    }

    subject.chapters.forEach((chapter, index) => {
        const progress = getChapterProgress(subjectKey, index);
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.innerHTML = `
            <div class="chapter-info">
                <h4>${chapter.name}</h4>
                <p>${chapter.questions.length}টি প্রশ্ন</p>
                ${progress ? `<span class="progress-badge">সর্বোচ্চ: ${progress.correct}/${progress.total}</span>` : ''}
            </div>
            <div class="chapter-right">
                ${progress ? '<span class="done-badge">✓</span>' : ''}
                <i class="fas fa-chevron-right chapter-arrow"></i>
            </div>
        `;
        card.onclick = () => showChapterMCQ(index);
        chaptersList.appendChild(card);
    });

    showPage('subject-page');
}

function showChapterMCQ(chapterIndex) {
    currentChapter = chapterIndex;
    const subject = subjectData[currentSubject];
    const chapter = subject.chapters[chapterIndex];
    currentQuestions = chapter.questions;

    document.getElementById('chapter-title').textContent = chapter.name;

    const mcqList = document.getElementById('mcq-list');
    mcqList.innerHTML = '';

    chapter.questions.forEach((q, index) => {
        const favKey = `${currentSubject}-${chapterIndex}-${q.id}`;
        const isFavorite = favorites.includes(favKey);
        
        const card = document.createElement('div');
        card.className = 'mcq-card';
        
        const optionsHTML = q.options.map((opt, i) => {
            return `<button 
                class="mcq-option" 
                data-option="${i}" 
                data-correct="${q.correct}"
                type="button">
                <span class="option-letter">${String.fromCharCode(97 + i)})</span> ${opt}
            </button>`;
        }).join('');

        card.innerHTML = `
            <div class="mcq-header">
                <div class="mcq-number">${index + 1}</div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        type="button"
                        id="fav-${index}">
                    <i class="fas fa-star"></i>
                </button>
            </div>
            <p class="mcq-question">${q.question}</p>
            <div class="mcq-options" id="options-${index}">
                ${optionsHTML}
            </div>
            <div class="mcq-actions">
                <button class="explain-btn" type="button" id="explain-btn-${index}">
                    <i class="fas fa-lightbulb"></i> ব্যাখ্যা দেখুন
                </button>
            </div>
            <div class="explanation-box" id="explain-${index}">
                <i class="fas fa-info-circle"></i> ${q.explanation}
            </div>
        `;
        
        mcqList.appendChild(card);

        // অপশন ক্লিক
        const optionsDiv = card.querySelector(`#options-${index}`);
        const optionBtns = optionsDiv.querySelectorAll('.mcq-option');
        optionBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const selectedOption = parseInt(this.getAttribute('data-option'));
                const correctOption = parseInt(this.getAttribute('data-correct'));
                
                // সব বাটন ডিসেবল
                optionBtns.forEach(b => {
                    b.disabled = true;
                    const bIndex = parseInt(b.getAttribute('data-option'));
                    if (bIndex === correctOption) {
                        b.style.background = '#e8f5e9';
                        b.style.borderColor = '#00c853';
                        b.style.color = '#2e7d32';
                        b.style.fontWeight = '600';
                    } else if (bIndex === selectedOption && selectedOption !== correctOption) {
                        b.style.background = '#ffebee';
                        b.style.borderColor = '#ff1744';
                        b.style.color = '#c62828';
                    }
                });
            });
        });

        // ফেভারিট ক্লিক
        const favBtn = card.querySelector(`#fav-${index}`);
        favBtn.addEventListener('click', function() {
            const key = `${currentSubject}-${chapterIndex}-${q.id}`;
            if (favorites.includes(key)) {
                favorites = favorites.filter(f => f !== key);
                this.classList.remove('active');
            } else {
                favorites.push(key);
                this.classList.add('active');
                showToast('প্রশ্নটি সেভ হয়েছে ⭐');
            }
            localStorage.setItem('favorites', JSON.stringify(favorites));
        });

        // ব্যাখ্যা ক্লিক
        const explainBtn = card.querySelector(`#explain-btn-${index}`);
        const explainBox = card.querySelector(`#explain-${index}`);
        explainBtn.addEventListener('click', function() {
            explainBox.style.display = 
                explainBox.style.display === 'block' ? 'none' : 'block';
        });
    });

    saveStudyHistory(currentSubject, chapterIndex);
    showPage('mcq-read-page');
    startAdTimer();
}

function startExam() {
    if (currentQuestions.length < 5) {
        showToast('পর্যাপ্ত প্রশ্ন নেই!');
        return;
    }
    examQuestions = shuffleArray([...currentQuestions]).slice(0, Math.min(30, currentQuestions.length));
    currentQuestionIndex = 0;
    userAnswers = new Array(examQuestions.length).fill(-1);
    timeLeft = examQuestions.length * 60;
    showPage('exam-page');
    loadExamQuestion();
    startTimer();
}

function loadExamQuestion() {
    const q = examQuestions[currentQuestionIndex];
    document.getElementById('exam-question').textContent = q.question;
    document.getElementById('question-counter').textContent =
        `প্রশ্ন ${currentQuestionIndex + 1}/${examQuestions.length}`;

    const fill = ((currentQuestionIndex + 1) / examQuestions.length) * 100;
    document.getElementById('exam-progress-fill').style.width = fill + '%';

    const optionsContainer = document.getElementById('exam-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'exam-option' + (userAnswers[currentQuestionIndex] === i ? ' selected' : '');
        btn.innerHTML = `<span class="option-letter">${String.fromCharCode(97 + i)})</span> ${opt}`;
        btn.addEventListener('click', () => selectExamOption(i));
        optionsContainer.appendChild(btn);
    });

    document.getElementById('prev-btn').style.display =
        currentQuestionIndex === 0 ? 'none' : 'inline-flex';

    if (currentQuestionIndex === examQuestions.length - 1) {
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('submit-btn').classList.remove('hidden');
    } else {
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('submit-btn').classList.add('hidden');
    }
}

function selectExamOption(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    document.querySelectorAll('.exam-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === optionIndex);
    });
}

function nextQuestion() {
    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        loadExamQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadExamQuestion();
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('timer').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitExam();
        }
    }, 1000);
}

function submitExam() {
    clearInterval(timerInterval);
    let correct = 0, wrong = 0, skip = 0;
    examQuestions.forEach((q, i) => {
        if (userAnswers[i] === -1) skip++;
        else if (userAnswers[i] === q.correct) correct++;
        else wrong++;
    });
    const total = examQuestions.length;
    const percentage = Math.round((correct / total) * 100);
    const points = correct * 10;
    totalPoints += points;
    localStorage.setItem('totalPoints', totalPoints);

    document.getElementById('result-marks').textContent = correct;
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = wrong;
    document.getElementById('skip-count').textContent = skip;
    document.getElementById('result-percentage').textContent = `${percentage}%`;
    document.getElementById('result-points').textContent = `+${points} পয়েন্ট`;

    if (percentage >= 80) {
        document.getElementById('result-icon').textContent = '🎉';
        document.getElementById('result-title').textContent = 'অসাধারণ!';
    } else if (percentage >= 60) {
        document.getElementById('result-icon').textContent = '👍';
        document.getElementById('result-title').textContent = 'ভালো করেছ!';
    } else if (percentage >= 40) {
        document.getElementById('result-icon').textContent = '😊';
        document.getElementById('result-title').textContent = 'আরো পড়তে হবে!';
    } else {
        document.getElementById('result-icon').textContent = '📚';
        document.getElementById('result-title').textContent = 'মনোযোগ দিয়ে পড়ো!';
    }
    saveProgress(correct, total);
    updateLeaderboard();
    showPage('result-page');
}

function reviewAnswers() {
    showPage('mcq-read-page');
}

function goBackToChapters() {
    showPage('subject-page');
}

function saveProgress(correct, total) {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    const key = `${currentSubject}-${currentChapter}`;
    if (!progress[key] || progress[key].correct < correct) {
        progress[key] = { correct, total, date: new Date().toLocaleDateString('bn-BD') };
        localStorage.setItem('progress', JSON.stringify(progress));
    }
}

function getChapterProgress(subject, chapter) {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    return progress[`${subject}-${chapter}`] || null;
}

function saveStudyHistory(subject, chapter) {
    const subjectName = subjectData[subject].name;
    const chapterName = subjectData[subject].chapters[chapter].name;
    const history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    history.unshift({
        subject: subjectName,
        chapter: chapterName,
        date: new Date().toLocaleDateString('bn-BD'),
        time: new Date().toLocaleTimeString('bn-BD')
    });
    if (history.length > 20) history.pop();
    localStorage.setItem('studyHistory', JSON.stringify(history));
}

function updateLeaderboard() {
    const leaderList = document.getElementById('leaderboard-list');
    if (!leaderList) return;
    const myName = currentUser ? currentUser.name : 'আমি';
    const leaderData = [
        { name: 'রাহেলা আক্তার', score: 985 },
        { name: 'করিম হোসেন', score: 942 },
        { name: 'সুমাইয়া বেগম', score: 897 },
        { name: myName, score: totalPoints },
    ].sort((a, b) => b.score - a.score).slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const classes = ['gold', 'silver', 'bronze', '', ''];
    leaderList.innerHTML = leaderData.map((item, i) => `
        <div class="leader-item ${classes[i]} ${item.name === myName ? 'my-rank' : ''}">
            <span class="rank">${medals[i]}</span>
            <span class="name">${item.name} ${item.name === myName ? '(আপনি)' : ''}</span>
            <span class="score">${item.score} পয়েন্ট</span>
        </div>
    `).join('');
}

function loginUser() {
    const name = document.getElementById('login-name').value;
    const phone = document.getElementById('login-phone').value;
    if (!name || !phone) {
        showToast('নাম ও ফোন নম্বর দিন!');
        return;
    }
    currentUser = { name, phone, joinDate: new Date().toLocaleDateString('bn-BD') };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUserUI();
    showToast(`স্বাগতম ${name}! 🎉`);
    showPage('home-page');
}

function loginWithGoogle() {
    showToast('শীঘ্রই আসছে!');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showPage('home-page');
    showToast('লগআউট সফল!');
}

let adTimer = null;
function startAdTimer() {
    if (Date.now() < adFreeUntil) return;
    if (adTimer) clearTimeout(adTimer);
    adTimer = setTimeout(() => {
        if (Date.now() >= adFreeUntil) showAdModal();
    }, 180000);
}

function showAdModal() {
    document.getElementById('ad-modal').classList.remove('hidden');
    // এডমিনের বসানো বিজ্ঞাপন কোড দেখানো হয় (ads-config.js থেকে), মেয়াদ পার হলে ডিফল্ট দেখানো হয়
    const placeholder = document.getElementById('ad-placeholder');
    const isExpired = typeof adConfig !== 'undefined' && adConfig.expiry && new Date() > new Date(adConfig.expiry + 'T23:59:59');
    if (typeof adConfig !== 'undefined' && adConfig.html && !isExpired) {
        placeholder.innerHTML = adConfig.html;
    } else {
        placeholder.innerHTML = '<div class="fake-ad">📢 বিজ্ঞাপন</div>';
    }
    let countdown = 5;
    const countdownEl = document.getElementById('ad-countdown');
    const closeBtn = document.getElementById('close-ad-btn');
    closeBtn.classList.add('hidden');
    const timer = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(timer);
            closeBtn.classList.remove('hidden');
        }
    }, 1000);
}

function closeAd() {
    document.getElementById('ad-modal').classList.add('hidden');
    adFreeUntil = Date.now() + 3600000;
    localStorage.setItem('adFreeUntil', adFreeUntil);
    showToast('১ ঘন্টা বিজ্ঞাপনমুক্ত! 🎉');
    startAdTimer();
}

function showFavorites() {
    const favList = document.getElementById('favorites-list');
    favList.innerHTML = '';
    if (favorites.length === 0) {
        favList.innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>কোনো সেভ করা প্রশ্ন নেই</p></div>';
    } else {
        favorites.forEach(key => {
            const parts = key.split('-');
            const subject = parts[0];
            const chapterIdx = parseInt(parts[1]);
            const questionId = parseInt(parts[2]);
            if (subjectData[subject] && subjectData[subject].chapters[chapterIdx]) {
                const question = subjectData[subject].chapters[chapterIdx].questions.find(q => q.id === questionId);
                if (question) {
                    const card = document.createElement('div');
                    card.className = 'mcq-card';
                    card.innerHTML = `
                        <div class="fav-subject-tag">${subjectData[subject].name}</div>
                        <p class="mcq-question">${question.question}</p>
                        <div class="mcq-options">
                            ${question.options.map((opt, i) => `
                                <button class="mcq-option ${i === question.correct ? 'correct' : ''}" disabled>
                                    <span class="option-letter">${String.fromCharCode(97 + i)})</span> ${opt}
                                </button>
                            `).join('')}
                        </div>
                        <div class="explanation-box" style="display:block">
                            <i class="fas fa-info-circle"></i> ${question.explanation}
                        </div>
                    `;
                    favList.appendChild(card);
                }
            }
        });
    }
    showPage('favorites-page');
}

function showHistory() {
    const history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>কোনো পড়ার ইতিহাস নেই</p></div>';
    } else {
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-card';
            div.innerHTML = `
                <div class="history-info">
                    <h4>${item.chapter}</h4>
                    <p>${item.subject}</p>
                </div>
                <div class="history-time">
                    <p>${item.date}</p>
                    <p>${item.time}</p>
                </div>
            `;
            historyList.appendChild(div);
        });
    }
    showPage('history-page');
}

function showProfile() {
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-phone').textContent = currentUser.phone;
    document.getElementById('profile-points').textContent = totalPoints;
    document.getElementById('profile-join').textContent = currentUser.joinDate;
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    document.getElementById('profile-exams').textContent = Object.keys(progress).length;
    showPage('profile-page');
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function toggleAIChat() {
    const chatBox = document.getElementById('ai-chat-box');
    chatBox.classList.toggle('hidden');
}

function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML += `
        <div class="chat-message user-message"><p>${message}</p></div>
    `;
    input.value = '';
    setTimeout(() => {
        const response = getAIResponse(message);
        chatMessages.innerHTML += `
            <div class="chat-message ai-message"><p>${response}</p></div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getAIResponse(message) {
    const msg = message.toLowerCase();
    if (msg.includes('হিসাব')) return 'হিসাব সমীকরণ: সম্পদ = দায় + মালিকানাস্বত্ব।';
    if (msg.includes('ব্যবস্থাপনা')) return 'ব্যবস্থাপনার জনক Henry Fayol। ১৪টি নীতি দিয়েছেন।';
    if (msg.includes('ফিন্যান্স')) return 'অর্থায়নের মূল লক্ষ্য সম্পদ সর্বাধিক করা।';
    if (msg.includes('বাংলা')) return 'বাংলা সাহিত্যের আদি নিদর্শন চর্যাপদ।';
    if (msg.includes('পদার্থ')) return 'আলোর গতি ৩×১০⁸ মি/সে।';
    if (msg.includes('রসায়ন')) return 'পানির সংকেত H₂O।';
    if (msg.includes('ইতিহাস')) return 'বাংলাদেশ স্বাধীন হয় ১৯৭১ সালে।';
    if (msg.includes('পরীক্ষা')) return 'নিয়মিত MCQ পড়ুন এবং পরীক্ষা দিন।';
    return 'আপনার প্রশ্নটি আরো স্পষ্ট করুন। আমি সাহায্য করতে প্রস্তুত! 😊';
}

function handleAIInput(event) {
    if (event.key === 'Enter') sendAIMessage();
}
