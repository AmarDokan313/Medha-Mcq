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
let readingStartTime = Date.now();
let totalReadingTime = parseInt(localStorage.getItem('totalReadingTime') || '0');

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
            checkAdTimer();
        }, 500);
    }, 2500);
});

// বিষয় দেখানো
function showSubject(subjectKey) {
    currentSubject = subjectKey;
    const subject = subjectData[subjectKey];
    document.getElementById('subject-title').textContent = subject.name;

    const chaptersList = document.getElementById('chapters-list');
    chaptersList.innerHTML = '';

    subject.chapters.forEach((chapter, index) => {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.innerHTML = `
            <div class="chapter-info">
                <h4>${chapter.name}</h4>
                <p>${chapter.questions.length}টি প্রশ্ন উপলব্ধ</p>
            </div>
            <div class="chapter-arrow">
                <i class="fas fa-chevron-right"></i>
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
        const isFavorite = favorites.includes(`${currentSubject}-${chapterIndex}-${q.id}`);
        const card = document.createElement('div');
        card.className = 'mcq-card';
        card.innerHTML = `
            <div class="mcq-number">${index + 1}</div>
            <p class="mcq-question">${q.question}</p>
            <div class="mcq-options">
                ${q.options.map((opt, i) => `
                    <button class="mcq-option" onclick="selectMCQOption(this, ${index}, ${i})">
                        ${String.fromCharCode(97 + i)}) ${opt}
                    </button>
                `).join('')}
            </div>
            <div class="mcq-actions">
                <button class="explain-btn" onclick="toggleExplanation(${index})">
                    <i class="fas fa-lightbulb"></i> ব্যাখ্যা
                </button>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        onclick="toggleFavorite(${index})" id="fav-${index}">
                    <i class="fas fa-star"></i> ${isFavorite ? 'সেভ করা আছে' : 'সেভ করুন'}
                </button>
            </div>
            <div class="explanation-box" id="explain-${index}">
                💡 ${q.explanation}
            </div>
        `;
        mcqList.appendChild(card);
    });

    showPage('mcq-read-page');
    startAdTimer();
}

// MCQ অপশন সিলেক্ট
function selectMCQOption(btn, qIndex, optionIndex) {
    const question = currentQuestions[qIndex];
    const options = btn.parentElement.querySelectorAll('.mcq-option');

    options.forEach(opt => {
        opt.classList.remove('correct', 'wrong');
        opt.disabled = false;
    });

    options.forEach((opt, i) => {
        opt.disabled = true;
        if (i === question.correct) {
            opt.classList.add('correct');
        } else if (i === optionIndex && optionIndex !== question.correct) {
            opt.classList.add('wrong');
        }
    });
}

// ব্যাখ্যা টগল
function toggleExplanation(index) {
    const explainBox = document.getElementById(`explain-${index}`);
    explainBox.style.display = explainBox.style.display === 'block' ? 'none' : 'block';
}

// ফেভারিট টগল
function toggleFavorite(index) {
    const key = `${currentSubject}-${currentChapter}-${currentQuestions[index].id}`;
    const btn = document.getElementById(`fav-${index}`);

    if (favorites.includes(key)) {
        favorites = favorites.filter(f => f !== key);
        btn.innerHTML = '<i class="fas fa-star"></i> সেভ করুন';
        btn.classList.remove('active');
    } else {
        favorites.push(key);
        btn.innerHTML = '<i class="fas fa-star"></i> সেভ করা আছে';
        btn.classList.add('active');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// পরীক্ষা শুরু
function startExam() {
    const allQuestions = currentQuestions;
    if (allQuestions.length < 5) {
        alert('এই অধ্যায়ে পর্যাপ্ত প্রশ্ন নেই!');
        return;
    }

    examQuestions = shuffleArray([...allQuestions]).slice(0, Math.min(30, allQuestions.length));
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
        btn.textContent = `${String.fromCharCode(97 + i)}) ${opt}`;
        btn.onclick = () => selectExamOption(i);
        optionsContainer.appendChild(btn);
    });

    document.getElementById('prev-btn').style.display =
        currentQuestionIndex === 0 ? 'none' : 'block';

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
    let correct = 0;
    let wrong = 0;
    let skip = 0;

    examQuestions.forEach((q, i) => {
        if (userAnswers[i] === -1) skip++;
        else if (userAnswers[i] === q.correct) correct++;
        else wrong++;
    });

    const total = examQuestions.length;
    const percentage = Math.round((correct / total) * 100);

    document.getElementById('result-marks').textContent = correct;
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = wrong;
    document.getElementById('skip-count').textContent = skip;
    document.getElementById('result-percentage').textContent = `${percentage}%`;

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
        document.getElementById('result-title').textContent = 'আরো মনোযোগ দাও!';
    }

    showPage('result-page');
    saveProgress(correct, total);
}

// উত্তর রিভিউ
function reviewAnswers() {
    showPage('mcq-read-page');
}

// পিছনে যাওয়া
function goBackToChapters() {
    showPage('subject-page');
}

// ডার্ক মোড
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
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

function checkAdTimer() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
}

function showAdModal() {
    document.getElementById('ad-modal').classList.remove('hidden');
    let countdown = 5;
    const countdownEl = document.getElementById('ad-countdown');
    const closeBtn = document.getElementById('close-ad-btn');
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
    document.getElementById('close-ad-btn').classList.add('hidden');
    startAdTimer();
}

// গুগল লগিন
function loginWithGoogle() {
    alert('Google লগিন শীঘ্রই আসছে! Firebase সংযুক্ত করতে হবে।');
}

// প্রগ্রেস সেভ
function saveProgress(correct, total) {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    const key = `${currentSubject}-${currentChapter}`;
    if (!progress[key] || progress[key].correct < correct) {
        progress[key] = { correct, total, date: new Date().toLocaleDateString('bn-BD') };
        localStorage.setItem('progress', JSON.stringify(progress));
    }
}

// অ্যারে শাফেল
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
