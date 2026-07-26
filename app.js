// subjectData কে window-এ এক্সপোজ করা হচ্ছে যাতে module script (question-sync.js) থেকে অ্যাক্সেস করা যায়
if (typeof subjectData !== 'undefined') window.subjectData = subjectData;

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

// ---------------- পয়েন্ট সার্ভারে (Supabase) সেভ রাখার জন্য ----------------
// ফোন নম্বর দিয়ে পয়েন্ট ট্র্যাক করা হয়, যাতে লগআউট করলে বা অন্য ডিভাইসে
// একই নম্বর দিয়ে লগইন করলেও আগের পয়েন্ট ফিরে পাওয়া যায়
const SCORE_SUPABASE_URL = 'https://pvxowurhtumxyedgezyg.supabase.co';
const SCORE_ANON_KEY = 'sb_publishable_cTjhayZgxlFjfm9x9aVRew_WrO9_dEm';

async function fetchServerPoints(phone) {
    const res = await fetch(`${SCORE_SUPABASE_URL}/rest/v1/user_scores?phone=eq.${encodeURIComponent(phone)}&select=points,name`, {
        headers: { apikey: SCORE_ANON_KEY, Authorization: `Bearer ${SCORE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error('স্কোর আনা যায়নি');
    const data = await res.json();
    return (data && data.length > 0) ? data[0] : null;
}

async function createServerScoreRow(phone, name) {
    await fetch(`${SCORE_SUPABASE_URL}/rest/v1/user_scores`, {
        method: 'POST',
        headers: {
            apikey: SCORE_ANON_KEY,
            Authorization: `Bearer ${SCORE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
        },
        body: JSON.stringify({ phone, name, points: 0 })
    });
}

async function submitScoreToServer(identifier, name, correct, total) {
    const res = await fetch(`${SCORE_SUPABASE_URL}/functions/v1/submit-score`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SCORE_ANON_KEY}`
        },
        body: JSON.stringify({ identifier, name, correct, total })
    });
    const data = await res.json();
    if (data && typeof data.totalPoints === 'number') {
        // সার্ভারই আসল সংখ্যা ঠিক করে দেয়, লোকাল ভ্যালু সেটার সাথে মিলিয়ে নেওয়া হচ্ছে
        totalPoints = data.totalPoints;
        localStorage.setItem('totalPoints', totalPoints);
    }
    return data;
}

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
    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
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

/* ================= মডেল টেস্ট সিস্টেম ================= */

let examAutoAdvance = false; // মডেল টেস্টে অটো-এডভান্স চালু থাকে, অধ্যায়ের পরীক্ষায় বন্ধ

function showModelSubjects() {
    const list = document.getElementById('model-subjects-list');
    list.innerHTML = '';

    if (!window.subjectData) return;

    Object.keys(window.subjectData).forEach(key => {
        const subj = window.subjectData[key];
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.onclick = () => showModelList(key);
        card.innerHTML = `
            <h3>${subj.name}</h3>
            <p>মডেল টেস্ট দিতে ট্যাপ করো</p>
        `;
        list.appendChild(card);
    });

    showPage('model-subjects-page');
}

function showModelList(subjectKey) {
    currentSubject = subjectKey;
    const subj = window.subjectData[subjectKey];
    document.getElementById('model-list-title').textContent = subj ? subj.name + ' — মডেল টেস্ট' : 'মডেল টেস্ট';

    const renderModels = () => {
        const list = document.getElementById('model-list');
        list.innerHTML = '';
        const models = (window.modelTestData && window.modelTestData[subjectKey]) || {};
        const modelNumbers = Object.keys(models).map(Number).sort((a, b) => a - b);

        if (modelNumbers.length === 0) {
            list.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i>এই বিষয়ে এখনো কোনো মডেল টেস্ট যোগ হয়নি</div>';
            return;
        }

        modelNumbers.forEach(num => {
            const qCount = models[num].length;
            const card = document.createElement('div');
            card.className = 'chapter-card';
            card.onclick = () => startModelExam(subjectKey, num);
            card.innerHTML = `
                <h3>মডেল টেস্ট ${num}</h3>
                <p>${qCount}টি প্রশ্ন</p>
            `;
            list.appendChild(card);
        });
    };

    renderModels();
    showPage('model-list-page');
}

function startModelExam(subjectKey, modelNumber) {
    const models = (window.modelTestData && window.modelTestData[subjectKey]) || {};
    const questions = models[modelNumber];

    if (!questions || questions.length < 5) {
        showToast('পর্যাপ্ত প্রশ্ন নেই!');
        return;
    }

    currentSubject = subjectKey;
    examQuestions = shuffleArray([...questions]).slice(0, Math.min(30, questions.length));
    currentQuestionIndex = 0;
    userAnswers = new Array(examQuestions.length).fill(-1);
    timeLeft = examQuestions.length * 60;
    examAutoAdvance = true;

    showPage('exam-page');
    loadExamQuestion();
    startTimer();

    if (!isPremium()) startAdTimer();
}

function startExam() {
    examAutoAdvance = false;
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
        (currentQuestionIndex === 0 || examAutoAdvance) ? 'none' : 'inline-flex';

    if (examAutoAdvance) {
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('submit-btn').classList.add('hidden');
    } else if (currentQuestionIndex === examQuestions.length - 1) {
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

    if (examAutoAdvance) {
        setTimeout(() => {
            if (currentQuestionIndex < examQuestions.length - 1) {
                currentQuestionIndex++;
                loadExamQuestion();
            } else {
                submitExam();
            }
        }, 400);
    }
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

    // পয়েন্ট সার্ভারে পাঠানো হচ্ছে — সংখ্যা না, শুধু "কয়টা সঠিক/মোট কয়টা প্রশ্ন",
    // সার্ভার নিজে হিসাব করে যোগ করবে (সরাসরি টেবিল এডিট আর সম্ভব না)
    const scoreIdentifier = currentUser ? (currentUser.email || currentUser.phone) : null;
    if (scoreIdentifier) {
        submitScoreToServer(scoreIdentifier, currentUser.name, correct, total).catch(() => {});
    }

    document.getElementById('result-marks').textContent = correct;
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = wrong;
    document.getElementById('skip-count').textContent = skip;
    document.getElementById('result-percentage').textContent = `${percentage}%`;
    document.getElementById('result-points').textContent = `+${points} পয়েন্ট`;

    // স্কোর ট্র্যাকে ক্যারেক্টার হেঁটে গিয়ে স্কোর % পয়েন্টে থামবে
    const scoreFillEl = document.getElementById('score-track-fill');
    const scoreCharEl = document.getElementById('score-character');
    if (scoreFillEl && scoreCharEl) {
        scoreFillEl.style.transition = 'none';
        scoreCharEl.style.transition = 'none';
        scoreFillEl.style.width = '0%';
        scoreCharEl.style.left = '0%';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scoreFillEl.style.transition = 'width 1.7s cubic-bezier(.34,1.56,.64,1)';
                scoreCharEl.style.transition = 'left 1.7s cubic-bezier(.34,1.56,.64,1)';
                scoreFillEl.style.width = percentage + '%';
                scoreCharEl.style.left = percentage + '%';
            });
        });
    }

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
    if (!examAutoAdvance) saveProgress(correct, total);
    updateLeaderboard();
    showPage('result-page');
}

function reviewAnswers() {
    const mcqList = document.getElementById('mcq-list');
    if (!mcqList || !examQuestions || examQuestions.length === 0) {
        showToast('রিভিউ দেখানো যায়নি!');
        return;
    }

    const titleEl = document.getElementById('chapter-title');
    if (titleEl) titleEl.textContent = 'উত্তর রিভিউ';

    mcqList.innerHTML = '';

    examQuestions.forEach((q, index) => {
        const selected = userAnswers[index];

        const card = document.createElement('div');
        card.className = 'mcq-card';

        const optionsHTML = q.options.map((opt, i) => {
            let style = '';
            if (i === q.correct) {
                style = 'background:#e8f5e9;border-color:#00c853;color:#2e7d32;font-weight:600;';
            } else if (i === selected && selected !== q.correct) {
                style = 'background:#ffebee;border-color:#ff1744;color:#c62828;';
            }
            return `<button class="mcq-option" type="button" disabled style="${style}">
                <span class="option-letter">${String.fromCharCode(97 + i)})</span> ${opt}
            </button>`;
        }).join('');

        let statusText, statusColor;
        if (selected === -1) { statusText = 'স্কিপ করা হয়েছে'; statusColor = '#999'; }
        else if (selected === q.correct) { statusText = 'সঠিক ✓'; statusColor = '#2e7d32'; }
        else { statusText = 'ভুল ✗'; statusColor = '#c62828'; }

        card.innerHTML = `
            <div class="mcq-header">
                <div class="mcq-number">${index + 1}</div>
                <span style="font-size:0.85rem;font-weight:600;color:${statusColor}">${statusText}</span>
            </div>
            <p class="mcq-question">${q.question}</p>
            <div class="mcq-options">${optionsHTML}</div>
            <div class="mcq-actions">
                <button class="explain-btn" type="button" id="review-explain-btn-${index}">
                    <i class="fas fa-lightbulb"></i> ব্যাখ্যা দেখুন
                </button>
            </div>
            <div class="explanation-box" id="review-explain-${index}">
                <i class="fas fa-info-circle"></i> ${q.explanation}
            </div>
        `;
        mcqList.appendChild(card);

        const explainBtn = card.querySelector(`#review-explain-btn-${index}`);
        const explainBox = card.querySelector(`#review-explain-${index}`);
        explainBtn.addEventListener('click', function () {
            explainBox.style.display = explainBox.style.display === 'block' ? 'none' : 'block';
        });
    });

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
    const leaderListFull = document.getElementById('leaderboard-list-full');
    if (!leaderList && !leaderListFull) return;
    const myName = currentUser ? currentUser.name : 'আমি';
    const leaderData = [
        { name: 'রাহেলা আক্তার', score: 985 },
        { name: 'করিম হোসেন', score: 942 },
        { name: 'সুমাইয়া বেগম', score: 897 },
        { name: myName, score: totalPoints },
    ].sort((a, b) => b.score - a.score).slice(0, 5);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const classes = ['gold', 'silver', 'bronze', '', ''];
    const html = leaderData.map((item, i) => `
        <div class="leader-item ${classes[i]} ${item.name === myName ? 'my-rank' : ''}">
            <span class="rank">${medals[i]}</span>
            <span class="name">${item.name} ${item.name === myName ? '(আপনি)' : ''}</span>
            <span class="score">${item.score} পয়েন্ট</span>
        </div>
    `).join('');

    if (leaderList) leaderList.innerHTML = html;
    if (leaderListFull) leaderListFull.innerHTML = html;
}

async function loginUser() {
    const name = document.getElementById('login-name').value.trim();
    const phone = document.getElementById('login-phone').value.trim();
    if (!name || !phone) {
        showToast('নাম ও ফোন নম্বর দিন!');
        return;
    }
    currentUser = { name, phone, joinDate: new Date().toLocaleDateString('bn-BD') };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    // এই ফোন নম্বরের আগের পয়েন্ট সার্ভার থেকে খুঁজে আনা হচ্ছে
    try {
        const existing = await fetchServerPoints(phone);
        if (existing) {
            totalPoints = existing.points || 0;
        } else {
            totalPoints = 0;
            await createServerScoreRow(phone, name);
        }
        localStorage.setItem('totalPoints', totalPoints);
    } catch (e) {
        // সার্ভারে সমস্যা হলেও লগইন আটকাবে না, আপাতত লোকাল পয়েন্ট দিয়েই চলবে
    }

    updateUserUI();
    updateLeaderboard();
    showToast(`স্বাগতম ${name}! 🎉`);
    showPage('home-page');
}

async function loginWithGoogle() {
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        const supabase = createClient(SCORE_SUPABASE_URL, SCORE_ANON_KEY);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href }
        });
        if (error) {
            showToast('Google Login শুরু করা যায়নি: ' + error.message);
        }
        // সফল হলে Google-এর পেজে নিয়ে যাবে, তারপর সাইটে ফিরিয়ে আনবে —
        // ফেরার পর নিচের handleGoogleRedirect() ফাংশনটা লগইন সম্পূর্ণ করবে
    } catch (e) {
        showToast('একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
}

// Google থেকে ফেরার পর সেশন চেক করে লগইন সম্পূর্ণ করা এবং পয়েন্ট সিঙ্ক করা
async function handleGoogleRedirect() {
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        const supabase = createClient(SCORE_SUPABASE_URL, SCORE_ANON_KEY);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) return;

        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email;

        currentUser = { name, email, phone: email, joinDate: new Date().toLocaleDateString('bn-BD') };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // ইমেইল দিয়ে আগের পয়েন্ট খোঁজা/তৈরি করা হচ্ছে (ফোনের বদলে ইমেইল দিয়ে)
        const res = await fetch(`${SCORE_SUPABASE_URL}/rest/v1/user_scores?email=eq.${encodeURIComponent(email)}&select=points`, {
            headers: { apikey: SCORE_ANON_KEY, Authorization: `Bearer ${SCORE_ANON_KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
            totalPoints = data[0].points || 0;
        } else {
            totalPoints = 0;
            await fetch(`${SCORE_SUPABASE_URL}/rest/v1/user_scores`, {
                method: 'POST',
                headers: {
                    apikey: SCORE_ANON_KEY,
                    Authorization: `Bearer ${SCORE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=ignore-duplicates'
                },
                body: JSON.stringify({ email, name, points: 0 })
            });
        }
        localStorage.setItem('totalPoints', totalPoints);

        updateUserUI();
        updateLeaderboard();
        showToast(`স্বাগতম ${name}! 🎉`);
    } catch (e) {
        // চুপচাপ থাকবে, সাধারণ (ফোন নম্বর) লগইন তো কাজ করছেই
    }
}

// পেজ লোড হওয়ার সাথে সাথেই চেক করা হবে Google থেকে ফেরত এসেছে কিনা
window.addEventListener('load', handleGoogleRedirect);

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
    const placeholder = document.getElementById('ad-placeholder');
    const countdownEl = document.getElementById('ad-countdown');
    const closeBtn = document.getElementById('close-ad-btn');
    closeBtn.classList.add('hidden');

    const isExpired = typeof adConfig !== 'undefined' && adConfig.expiry && new Date() > new Date(adConfig.expiry + 'T23:59:59');

    // ads তালিকা থেকে খালি/ফাঁকা এন্ট্রি বাদ দেওয়া হচ্ছে
    let ads = (typeof adConfig !== 'undefined' && Array.isArray(adConfig.ads))
        ? adConfig.ads.filter(a => a && a.html && a.html.trim())
        : [];

    if (isExpired) ads = [];

    // কোনো বিজ্ঞাপন সেট করা না থাকলে সাথে সাথেই বন্ধ করার সুযোগ দেওয়া হবে
    if (ads.length === 0) {
        placeholder.innerHTML = '';
        countdownEl.textContent = '0';
        closeBtn.classList.remove('hidden');
        return;
    }

    let adIndex = 0;
    let timer = null;

    function playNextAd() {
        if (adIndex >= ads.length) {
            if (timer) clearInterval(timer);
            countdownEl.textContent = '0';
            closeBtn.classList.remove('hidden');
            return;
        }

        // প্রতিটা ভিডিওর নিজের দৈর্ঘ্য (duration, সেকেন্ডে) অনুযায়ী অপেক্ষা করা হবে —
        // ভিডিও শেষ হওয়ার সাথে সাথেই পরের বিজ্ঞাপনে যাবে
        const ad = ads[adIndex];
        adIndex++;

        placeholder.innerHTML = ad.html;
        let countdown = (typeof ad.duration === 'number' && ad.duration > 0) ? ad.duration : 15;
        countdownEl.textContent = countdown;

        // ভিডিও (iframe) আসলে লোড হওয়ার পরই গণনা শুরু হবে, তার আগে না —
        // এতে ধীর নেটওয়ার্কেও ভিডিও দেখার পুরো সময়টুকু পাওয়া যাবে
        let countdownStarted = false;
        function startCountdown() {
            if (countdownStarted) return;
            countdownStarted = true;

            if (timer) clearInterval(timer);
            timer = setInterval(() => {
                countdown--;
                countdownEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(timer);
                    playNextAd();
                }
            }, 1000);
        }

        const iframeEl = placeholder.querySelector('iframe, video');
        if (iframeEl) {
            iframeEl.addEventListener('load', startCountdown);
            if (iframeEl.tagName === 'VIDEO') {
                iframeEl.addEventListener('loadeddata', startCountdown);
            }
            // কোনো কারণে load ইভেন্ট না এলেও (কিছু ব্রাউজারে cross-origin iframe-এ হয় না),
            // সর্বোচ্চ ৪ সেকেন্ড অপেক্ষার পর নিজে থেকেই গণনা শুরু হয়ে যাবে
            setTimeout(startCountdown, 4000);
        } else {
            startCountdown();
        }
    }

    playNextAd();
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

// এই দুটো তথ্য গোপনীয় না — anon key পাবলিক ব্যবহারের জন্যই বানানো,
// সত্যিকারের গোপন Gemini key শুধু Supabase Edge Function-এর ভেতরে (সার্ভারে) থাকে।
const AI_CHAT_SUPABASE_URL = 'https://pvxowurhtumxyedgezyg.supabase.co';
const AI_CHAT_ANON_KEY = 'sb_publishable_cTjhayZgxlFjfm9x9aVRew_WrO9_dEm';

let aiChatLoading = false;

function sendAIMessage() {
    if (aiChatLoading) return;

    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML += `
        <div class="chat-message user-message"><p>${escapeHtmlAI(message)}</p></div>
    `;
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    aiChatLoading = true;
    const loadingId = 'ai-loading-' + Date.now();
    chatMessages.innerHTML += `
        <div class="chat-message ai-message" id="${loadingId}"><p>উত্তর তৈরি হচ্ছে...</p></div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    getAIResponse(message)
        .then(response => {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.querySelector('p').textContent = response;
        })
        .catch(() => {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.querySelector('p').textContent = 'দুঃখিত, এখন উত্তর আনা যাচ্ছে না। একটু পর আবার চেষ্টা করো।';
        })
        .finally(() => {
            aiChatLoading = false;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
}

async function getAIResponse(message) {
    const res = await fetch(`${AI_CHAT_SUPABASE_URL}/functions/v1/quick-task`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_CHAT_ANON_KEY}`
        },
        body: JSON.stringify({ message })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
        throw new Error(data.error || 'AI চ্যাটে সমস্যা হয়েছে');
    }

    return data.reply;
}

function escapeHtmlAI(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function handleAIInput(event) {
    if (event.key === 'Enter') sendAIMessage();
}
// প্রিমিয়াম সিস্টেম
function showPremium() {
    showPage('premium-page');
}

function showPayment(method) {
    const modal = document.getElementById('payment-modal');
    const title = document.getElementById('payment-title');
    const number = document.getElementById('payment-number');

    if (method === 'bkash') {
        title.textContent = '📱 বিকাশে পেমেন্ট';
        number.textContent = '01XXXXXXXXX নম্বরে (বিকাশ)';
    } else {
        title.textContent = '📱 নগদে পেমেন্ট';
        number.textContent = '01XXXXXXXXX নম্বরে (নগদ)';
    }
    modal.classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function submitPayment() {
    const txId = document.getElementById('transaction-id').value.trim();
    const mobile = document.getElementById('user-mobile').value.trim();

    if (!txId || !mobile) {
        showToast('সব তথ্য দিন!');
        return;
    }

    // পেমেন্ট তথ্য সেভ
    const payment = {
        txId, mobile,
        amount: 149,
        date: new Date().toLocaleDateString('bn-BD'),
        status: 'pending'
    };

    const payments = JSON.parse(localStorage.getItem('payments') || '[]');
    payments.push(payment);
    localStorage.setItem('payments', JSON.stringify(payments));

    closePaymentModal();
    showToast('✅ আবেদন পাঠানো হয়েছে! যাচাই করা হবে।');

    document.getElementById('transaction-id').value = '';
    document.getElementById('user-mobile').value = '';
}

// প্রিমিয়াম চেক
function isPremium() {
    return localStorage.getItem('isPremium') === 'true';
}
/* =====================================================
   Premium Payment System - Medha MCQ
   এই কোড app.js ফাইলের একদম নিচে বসাও
===================================================== */

(function () {
    const PREMIUM_PRICE = 149;

    // এখানে তোমার আসল বিকাশ/নগদ নাম্বার বসাবে
    const PAYMENT_INFO = {
        bkash: {
            title: 'বিকাশে পেমেন্ট',
            number: '01XXXXXXXXX',
            methodName: 'বিকাশ'
        },
        nagad: {
            title: 'নগদে পেমেন্ট',
            number: '01XXXXXXXXX',
            methodName: 'নগদ'
        }
    };

    // এখানে তোমার WhatsApp নাম্বার বসাবে
    const ADMIN_WHATSAPP = '8801700000000';

    window.selectedPaymentMethod = null;

    window.showPayment = function (method) {
        window.selectedPaymentMethod = method;

        const info = PAYMENT_INFO[method];

        if (!info) {
            alert('পেমেন্ট মাধ্যম পাওয়া যায়নি!');
            return;
        }

        const paymentTitle = document.getElementById('payment-title');
        const paymentNumber = document.getElementById('payment-number');
        const transactionInput = document.getElementById('transaction-id');
        const mobileInput = document.getElementById('user-mobile');
        const paymentModal = document.getElementById('payment-modal');

        if (!paymentModal) {
            alert('Payment modal পাওয়া যায়নি। index.html চেক করুন।');
            return;
        }

        if (paymentTitle) {
            paymentTitle.innerText = info.title;
        }

        if (paymentNumber) {
            paymentNumber.innerText = info.number + ' নম্বরে';
        }

        if (transactionInput) {
            transactionInput.value = '';
        }

        if (mobileInput) {
            mobileInput.value = '';
        }

        paymentModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.closePaymentModal = function () {
        const paymentModal = document.getElementById('payment-modal');

        if (paymentModal) {
            paymentModal.classList.add('hidden');
        }

        document.body.style.overflow = '';
    };

    function normalizeBDMobile(value) {
        let mobile = String(value || '').replace(/\D/g, '');

        if (mobile.startsWith('88')) {
            mobile = mobile.slice(2);
        }

        return mobile;
    }

    window.submitPayment = function () {
        const transactionInput = document.getElementById('transaction-id');
        const mobileInput = document.getElementById('user-mobile');

        if (!transactionInput || !mobileInput) {
            alert('পেমেন্ট ইনপুট পাওয়া যায়নি।');
            return;
        }

        const trxId = transactionInput.value.trim();
        let mobile = mobileInput.value.trim();

        mobile = normalizeBDMobile(mobile);

        if (!window.selectedPaymentMethod) {
            alert('আগে পেমেন্ট মাধ্যম নির্বাচন করুন।');
            return;
        }

        if (trxId.length < 6) {
            alert('সঠিক Transaction ID লিখুন।');
            return;
        }

        if (!/^01[3-9]\d{8}$/.test(mobile)) {
            alert('সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।');
            return;
        }

        const info = PAYMENT_INFO[window.selectedPaymentMethod];

        const groupChoice = document.querySelector('input[name="premium-group-choice"]:checked');
        const groupValue = groupChoice ? groupChoice.value : 'commerce';
        const groupNames = { commerce: 'ব্যবসায় শাখা', science: 'বিজ্ঞান শাখা', humanities: 'মানবিক শাখা' };
        const groupLabel = groupNames[groupValue] || groupValue;

        const paymentRequest = {
            id: Date.now(),
            method: window.selectedPaymentMethod,
            methodName: info.methodName,
            transactionId: trxId,
            mobile: mobile,
            amount: PREMIUM_PRICE,
            group: groupValue,
            status: 'pending',
            date: new Date().toLocaleString('bn-BD')
        };

        const oldRequests = JSON.parse(localStorage.getItem('premiumPaymentRequests') || '[]');
        oldRequests.unshift(paymentRequest);

        localStorage.setItem('premiumPaymentRequests', JSON.stringify(oldRequests));
        localStorage.setItem('premiumStatus', 'pending');

        window.closePaymentModal();

        alert('আপনার পেমেন্ট অনুরোধ জমা হয়েছে। যাচাই করার পর প্রিমিয়াম চালু করা হবে।');

        const message =
`নতুন প্রিমিয়াম পেমেন্ট অনুরোধ

গ্রুপ: ${groupLabel}
পেমেন্ট মাধ্যম: ${info.methodName}
মোবাইল নম্বর: ${mobile}
Transaction ID: ${trxId}
পরিমাণ: ৳${PREMIUM_PRICE}
সময়: ${paymentRequest.date}`;

        const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;

        const sendToWhatsapp = confirm('দ্রুত যাচাইয়ের জন্য WhatsApp-এ পেমেন্ট তথ্য পাঠাতে চান?');

        if (sendToWhatsapp) {
            window.open(whatsappUrl, '_blank');
        }
    };

    // Modal এর বাইরে ক্লিক করলে বন্ধ হবে
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('payment-modal');

        if (modal && e.target === modal) {
            window.closePaymentModal();
        }
    });
})();

/* =====================================================
   প্রিমিয়াম সাবজেক্ট লক সিস্টেম - Medha MCQ
===================================================== */

(function () {
    const PREMIUM_KEY = 'isPremium';
    const EXPIRE_KEY = 'premiumExpireAt';
    const GROUP_KEY = 'premiumGroup';

    const GROUP_NAMES = { commerce: 'ব্যবসায় শাখা', humanities: 'মানবিক শাখা', science: 'বিজ্ঞান শাখা' };

    window.isPremiumActive = function () {
        const active = localStorage.getItem(PREMIUM_KEY) === 'true';
        const expireAt = Number(localStorage.getItem(EXPIRE_KEY) || 0);

        if (active && expireAt && Date.now() > expireAt) {
            localStorage.setItem(PREMIUM_KEY, 'false');
            localStorage.removeItem(EXPIRE_KEY);
            localStorage.removeItem(GROUP_KEY);
            return false;
        }
        return active;
    };

    // সাবজেক্ট কার্ডে লক দেখানো/সরানো — শুধু নিজের কেনা গ্রুপের বিষয় আনলক হবে
    window.updatePremiumLocks = function () {
        const active = window.isPremiumActive();
        const myGroup = localStorage.getItem(GROUP_KEY);

        document.querySelectorAll('.subject-card.premium-only').forEach(card => {
            const cardGroup = card.dataset.group;
            const unlocked = active && (cardGroup === 'any' || cardGroup === myGroup);
            card.classList.toggle('locked-subject', !unlocked);
        });

        const statusText = document.getElementById('premium-status-text');
        const btn = document.querySelector('.subject-premium-btn');
        const subText = document.querySelector('.premium-btn-sub');
        if (statusText) statusText.textContent = active ? 'চালু আছে' : 'প্রিমিয়াম';
        if (btn) btn.classList.toggle('active', active);
        if (subText) {
            if (active) {
                subText.textContent = `${GROUP_NAMES[myGroup] || ''} আনলক আছে`;
            } else {
                subText.textContent = 'সব বিষয় আনলক করো';
            }
        }

        // প্রিমিয়াম পেজে মেয়াদ দেখানো
        const unlockStatus = document.getElementById('unlock-status');
        if (unlockStatus) {
            if (active) {
                const expireAt = Number(localStorage.getItem(EXPIRE_KEY) || 0);
                const dateStr = expireAt ? new Date(expireAt).toLocaleDateString('bn-BD') : '';
                unlockStatus.style.color = '#00c853';
                unlockStatus.textContent = `✅ প্রিমিয়াম চালু আছে${dateStr ? ' — মেয়াদ শেষ: ' + dateStr : ''}`;
            } else {
                unlockStatus.textContent = '';
            }
        }
    };

    // আনলক কোড যাচাই করা — কোডটা কোন গ্রুপের তা কনফিগ থেকে বের করা হয়
    window.redeemUnlockCode = function () {
        const input = document.getElementById('unlock-code-input');
        const statusEl = document.getElementById('unlock-status');
        if (!input) return;

        const entered = input.value.trim().toUpperCase();

        if (typeof unlockConfig === 'undefined' || !unlockConfig.groups) {
            statusEl.style.color = '#ff1744';
            statusEl.textContent = '❌ সিস্টেম ত্রুটি, একটু পর আবার চেষ্টা করো।';
            return;
        }

        let matchedGroup = null;
        for (const groupKey in unlockConfig.groups) {
            const groupData = unlockConfig.groups[groupKey];
            const codes = (groupData.codes || []).map(c => String(c).trim().toUpperCase());
            if (codes.includes(entered)) {
                matchedGroup = groupKey;
                break;
            }
        }

        if (matchedGroup) {
            const groupData = unlockConfig.groups[matchedGroup];
            const expireAt = groupData.examEndDate
                ? new Date(groupData.examEndDate + 'T23:59:59').getTime()
                : Date.now() + 30 * 24 * 60 * 60 * 1000;
            localStorage.setItem(PREMIUM_KEY, 'true');
            localStorage.setItem(EXPIRE_KEY, String(expireAt));
            localStorage.setItem(GROUP_KEY, matchedGroup);
            input.value = '';
            window.updatePremiumLocks();
            const dateStr = new Date(expireAt).toLocaleDateString('bn-BD');
            statusEl.style.color = '#00c853';
            statusEl.textContent = `✅ ${GROUP_NAMES[matchedGroup] || ''} প্রিমিয়াম চালু হয়েছে! পরীক্ষা পর্যন্ত (${dateStr}) পড়তে পারবে।`;
        } else {
            statusEl.style.color = '#ff1744';
            statusEl.textContent = '❌ ভুল কোড! সঠিক কোডটি আবার চেক করো।';
        }
    };

    // লক করা সাবজেক্টে ক্লিক আটকানো
    document.addEventListener('click', function (e) {
        const card = e.target.closest('.subject-card');
        if (!card) return;
        if (card.classList.contains('locked-subject')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const goPremium = confirm('এই বিষয় পড়তে প্রিমিয়াম লাগবে। এখন প্রিমিয়াম পেজে যেতে চাও?');
            if (goPremium) showPage('premium-page');
            return false;
        }
    }, true);

    // পেজ লোড হলে লক স্ট্যাটাস আপডেট
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.updatePremiumLocks);
    } else {
        window.updatePremiumLocks();
    }
    window.addEventListener('load', () => setTimeout(window.updatePremiumLocks, 300));
})();
