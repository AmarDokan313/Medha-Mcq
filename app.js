// গ্লোবাল ভেরিয়েবল
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
let studyHistory = JSON.parse(localStorage.getItem('studyHistory') || '[]');
let totalPoints = parseInt(localStorage.getItem('totalPoints') || '0');

// পেজ দেখানো
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    window.scrollTo(0, 0);
}

// লোডিং স্ক্রিন
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
    }, 800);
});

// ডার্ক মোড লোড
function loadDarkMode() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
}

// ডার্ক মোড টগল
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// ইউজার UI আপডেট
function updateUserUI() {
    const loginBtn = document.querySelector('.login-btn');
    if (currentUser && loginBtn) {
        loginBtn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.name.split(' ')[0]}`;
    }
}

// বিষয় দেখানো
function showSubject(subjectKey) {
    currentSubject = subjectKey;
    const subject = subjectData[subjectKey];
    document.getElementById('subject-title').textContent = subject.name;

    const chaptersList = document.getElementById('chapters-list');
    chaptersList.innerHTML = '';

    subject.chapters.forEach((chapter, index) => {
        const progress = getChapterProgress(subjectKey, index);
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.innerHTML = `
            <div class="chapter-info">
                <h4>${chapter.name}</h4>
                <p>${chapter.questions.length}টি প্রশ্ন</p>
                ${progress ? `<div class="chapter-progress">
                    <span class="progress-badge">সর্বোচ্চ: ${progress.correct}/${progress.total}</span>
                </div>` : ''}
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

// অধ্যায়ের MCQ দেখানো
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
        card.innerHTML = `
            <div class="mcq-header">
                <div class="mcq-number">${index + 1}</div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        onclick="toggleFavorite(${index})" id="fav-${index}">
                    <i class="fas fa-star"></i>
                </button>
            </div>
            <p class="mcq-question">${q.question}</p>
            <div class="mcq-options">
                ${q.options.map((opt, i) => `
                    <button class="mcq-option" onclick="selectMCQOption(this, ${index}, ${i}, ${q.correct})">
                        <span class="option-letter">${String.fromCharCode(97 + i)})</span> ${opt}
                    </button>
                `).join('')}
            </div>
            <div class="mcq-actions">
                <button class="explain-btn" onclick="toggleExplanation(${index})">
                    <i class="fas fa-lightbulb"></i> ব্যাখ্যা দেখুন
                </button>
            </div>
            <div class="explanation-box" id="explain-${index}">
                <i class="fas fa-info-circle"></i> ${q.explanation}
            </div>
        `;
        mcqList.appendChild(card);
    });

    // পড়ার ইতিহাস সেভ
    saveStudyHistory(currentSubject, chapterIndex);
    showPage('mcq-read-page');
    startAdTimer();
}

// MCQ অপশন সিলেক্ট
function selectMCQOption(btn, qIndex, optionIndex, correctIndex) {
    const options = btn.parentElement.querySelectorAll('.mcq-option');
    options.forEach(opt => opt.disabled = true);

    options.forEach((opt, i) => {
        if (i === correctIndex) {
            opt.classList.add('correct');
        } else if (i === optionIndex && optionIndex !== correctIndex) {
            opt.classList.add('wrong');
        }
    });
}

// ব্যাখ্যা টগল
function toggleExplanation(index) {
    const box = document.getElementById(`explain-${index}`);
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

// ফেভারিট টগল
function toggleFavorite(index) {
    const key = `${currentSubject}-${currentChapter}-${currentQuestions[index].id}`;
    const btn = document.getElementById(`fav-${index}`);
    if (favorites.includes(key)) {
        favorites = favorites.filter(f => f !== key);
        btn.classList.remove('active');
    } else {
        favorites.push(key);
        btn.classList.add('active');
        showToast('প্রশ্নটি সেভ হয়েছে ⭐');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// পরীক্ষা শুরু
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

// পরীক্ষার প্রশ্ন লোড
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
        btn.onclick = () => selectExamOption(i);
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

// পরীক্ষার অপশন সিলেক্ট
function selectExamOption(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    document.querySelectorAll('.exam-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === optionIndex);
    });
}

// পরের প্রশ্ন
function nextQuestion() {
    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        loadExamQuestion();
    }
}

// আগের প্রশ্ন
function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadExamQuestion();
    }
}

// টাইমার
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

// পরীক্ষা জমা
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

// উত্তর রিভিউ
function reviewAnswers() {
    showPage('mcq-read-page');
}

// পিছনে যাওয়া
function goBackToChapters() {
    showPage('subject-page');
}

// প্রগ্রেস সেভ
function saveProgress(correct, total) {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    const key = `${currentSubject}-${currentChapter}`;
    if (!progress[key] || progress[key].correct < correct) {
        progress[key] = {
            correct, total,
            date: new Date().toLocaleDateString('bn-BD'),
            subject: currentSubject,
            chapter: currentChapter
        };
        localStorage.setItem('progress', JSON.stringify(progress));
    }
}

// চ্যাপ্টার প্রগ্রেস
function getChapterProgress(subject, chapter) {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    return progress[`${subject}-${chapter}`] || null;
}

// পড়ার ইতিহাস সেভ
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

// লিডারবোর্ড আপডেট
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

// লগিন
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

// গুগল লগিন
function loginWithGoogle() {
    showToast('শীঘ্রই আসছে! ফোন দিয়ে লগিন করুন।');
}

// লগআউট
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showPage('home-page');
    showToast('লগআউট সফল হয়েছে!');
}

// বিজ্ঞাপন টাইমার
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

// ফেভারিট পেজ
function showFavorites() {
    const favPage = document.getElementById('favorites-page');
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
                const chapter = subjectData[subject].chapters[chapterIdx];
                const question = chapter.questions.find(q => q.id === questionId);
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

// ইতিহাস পেজ
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

// প্রোফাইল পেজ
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

// টোস্ট নোটিফিকেশন
function showToast(message) {
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

// অ্যারে শাফেল
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// AI চ্যাট
function toggleAIChat() {
    const chatBox = document.getElementById('ai-chat-box');
    chatBox.classList.toggle('hidden');
}

function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    const chatMessages = document.getElementById('chat-messages');

    // ইউজার মেসেজ
    chatMessages.innerHTML += `
        <div class="chat-message user-message">
            <p>${message}</p>
        </div>
    `;

    input.value = '';

    // AI রেসপন্স
    setTimeout(() => {
        const response = getAIResponse(message);
        chatMessages.innerHTML += `
            <div class="chat-message ai-message">
                <p>${response}</p>
            </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getAIResponse(message) {
    const msg = message.toLowerCase();
    if (msg.includes('হিসাব') || msg.includes('accounting')) {
        return 'হিসাববিজ্ঞান সম্পর্কে জানতে চাইলে মূল সূত্র মনে রাখুন: সম্পদ = দায় + মালিকানাস্বত্ব। প্রতিটি লেনদেনে দুটি পক্ষ থাকে।';
    } else if (msg.includes('ব্যবস্থাপনা') || msg.includes('management')) {
        return 'ব্যবস্থাপনার মূল কাজ: পরিকল্পনা, সংগঠন, নির্দেশনা ও নিয়ন্ত্রণ। Henry Fayol ব্যবস্থাপনার ১৪টি নীতি দিয়েছেন।';
    } else if (msg.includes('ফিন্যান্স') || msg.includes('finance')) {
        return 'অর্থায়নের মূল লক্ষ্য শেয়ারহোল্ডারদের সম্পদ সর্বাধিক করা। ঝুঁকি ও আয় সমানুপাতিক।';
    } else if (msg.includes('বিপণন') || msg.includes('marketing')) {
        return 'বিপণন মিশ্রণের ৪টি উপাদান: Product, Price, Place, Promotion (4P)।';
    } else if (msg.includes('পরীক্ষা') || msg.includes('exam')) {
        return 'বোর্ড পরীক্ষার জন্য প্রতিটি অধ্যায় ভালোভাবে পড়ুন এবং MCQ পরীক্ষা দিন। নিয়মিত অনুশীলনই সাফল্যের চাবিকাঠি!';
    } else {
        return 'আপনার প্রশ্নটি বুঝতে পারিনি। হিসাববিজ্ঞান, ব্যবস্থাপনা, ফিন্যান্স বা বিপণন বিষয়ে প্রশ্ন করুন।';
    }
}

function handleAIInput(event) {
    if (event.key === 'Enter') {
        sendAIMessage();
    }
}
