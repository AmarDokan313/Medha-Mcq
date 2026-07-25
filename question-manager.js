// question-manager.js
// এডমিন/মডারেটরের জন্য Supabase-ভিত্তিক প্রশ্ন যোগ/এডিট/মুছার সিস্টেম
// এখন দুই ধরনের প্রশ্ন সাপোর্ট করে: অধ্যায়ভিত্তিক + মডেল টেস্ট (model_number দিয়ে)
// এটা সংযোজন মাত্র — নোটিফিকেশন/মডারেটর ম্যানেজমেন্ট সিস্টেম (admin-panel.js, auth.js) স্পর্শ করা হয়নি
// এই ফাইলটা root ফোল্ডারে রাখবে, admin.html এ admin-panel.js এর পরে type="module" দিয়ে যোগ করা আছে

import { supabase } from './supabase-config.js';

let myRole = { isAdmin: false, isModerator: false };
let myUserId = null;
let editingQuestionId = null;

async function loadMyRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    myUserId = session.user.id;
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_moderator')
        .eq('id', myUserId)
        .single();
    if (profile) {
        myRole = { isAdmin: !!profile.is_admin, isModerator: !!profile.is_moderator };
    }
}

window.addEventListener('load', () => {
    setTimeout(loadMyRole, 400);
    watchForAdminWrapAndFixVisibility();
});

// admin-panel.js এর applyRoleUI() ইনলাইন style.display='' সেট করে, কিন্তু CSS-এ
// .admin-only{display:none} থাকায় সেটা এডমিনের ক্ষেত্রেও লুকানোই থেকে যায় —
// এই ফাংশনটা সেই বাগ ঠিক করে, এডমিনের জন্য ক্লাসটাই সরিয়ে দেয়
function watchForAdminWrapAndFixVisibility() {
    const interval = setInterval(async () => {
        const wrap = document.getElementById('admin-wrap');
        if (wrap && wrap.style.display === 'block') {
            clearInterval(interval);
            await loadMyRole();
            if (myRole.isAdmin) {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('admin-only'));
            }
        }
    }, 400);
}

/* ================= মোড টগল (অধ্যায় / মডেল টেস্ট) ================= */

window.toggleAddMode = function () {
    const mode = document.getElementById('add-mode').value;
    document.getElementById('add-chapter-wrap').classList.toggle('hidden', mode === 'model');
    document.getElementById('add-model-wrap').classList.toggle('hidden', mode !== 'model');
};

window.toggleManageMode = function () {
    const mode = document.getElementById('manage-mode').value;
    document.getElementById('manage-chapter-wrap').classList.toggle('hidden', mode === 'model');
    document.getElementById('manage-model-wrap').classList.toggle('hidden', mode !== 'model');
    window.loadQuestionsList();
};

/* ================= প্রশ্ন যোগ / আপডেট ================= */

window.addQuestion = async function () {
    await loadMyRole();

    const subj = document.getElementById('add-subject').value;
    const modeSel = document.getElementById('add-mode');
    const mode = modeSel ? modeSel.value : 'chapter';
    const q = document.getElementById('add-question').value.trim();
    const a = document.getElementById('add-opt-a').value.trim();
    const b = document.getElementById('add-opt-b').value.trim();
    const c = document.getElementById('add-opt-c').value.trim();
    const d = document.getElementById('add-opt-d').value.trim();
    const correct = parseInt(document.getElementById('add-correct').value);
    const explain = document.getElementById('add-explain').value.trim();

    if (!q || !a || !b || !c || !d) {
        toast('❌ সব ঘর পূরণ করুন!');
        return;
    }

    const payload = {
        subject_key: subj,
        question: q,
        options: [a, b, c, d],
        correct: correct,
        explanation: explain || 'ব্যাখ্যা শীঘ্রই যোগ হবে।'
    };

    if (mode === 'model') {
        const modelNum = parseInt(document.getElementById('add-model-number').value);
        if (!modelNum || modelNum < 1 || modelNum > 100) {
            toast('❌ ১ থেকে ১০০ এর মধ্যে মডেল নম্বর দিন!');
            return;
        }
        payload.model_number = modelNum;
        payload.chapter_index = null;
    } else {
        const chap = parseInt(document.getElementById('add-chapter').value);
        payload.chapter_index = chap;
        payload.model_number = null;
    }

    let error;
    const wasEditing = !!editingQuestionId;

    if (wasEditing) {
        ({ error } = await supabase.from('questions').update(payload).eq('id', editingQuestionId));
    } else {
        payload.created_by = myUserId;
        ({ error } = await supabase.from('questions').insert(payload));
    }

    if (error) {
        toast('❌ সেভ করতে সমস্যা হয়েছে!');
        return;
    }

    ['add-question', 'add-opt-a', 'add-opt-b', 'add-opt-c', 'add-opt-d', 'add-explain'].forEach(id => {
        document.getElementById(id).value = '';
    });

    editingQuestionId = null;
    const saveBtn = document.getElementById('save-question-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> প্রশ্ন সেভ করুন';

    toast(wasEditing ? '✅ প্রশ্ন আপডেট হয়েছে!' : '✅ প্রশ্ন সেভ হয়েছে! সাথে সাথেই সাইটে দেখাবে।');
    window.loadQuestionsList();
};

/* ================= প্রশ্নের তালিকা ================= */

// প্রতিটা প্রশ্ন অবজেক্ট ব্রাউজারে ক্যাশ রাখা হয় যাতে এডিট বাটনে ক্লিক করলে আবার Supabase-এ না যেতে হয়
let lastLoadedQuestions = {};

window.loadQuestionsList = async function () {
    const subjSel = document.getElementById('manage-subject');
    const modeSel = document.getElementById('manage-mode');
    if (!subjSel || !subjSel.value) return;

    const subj = subjSel.value;
    const mode = modeSel ? modeSel.value : 'chapter';
    const list = document.getElementById('questions-list');
    if (!list) return;

    await loadMyRole();

    let query = supabase
        .from('questions')
        .select('id, subject_key, question, options, correct, explanation, created_by, chapter_index, model_number')
        .eq('subject_key', subj);

    if (mode === 'model') {
        const modelNum = parseInt(document.getElementById('manage-model-number').value);
        if (!modelNum) {
            list.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i>একটা মডেল নম্বর দিন</div>';
            return;
        }
        query = query.eq('model_number', modelNum);
    } else {
        const chapSel = document.getElementById('manage-chapter');
        if (!chapSel || !chapSel.value) return;
        query = query.eq('chapter_index', parseInt(chapSel.value));
    }

    const { data: qs, error } = await query.order('created_at', { ascending: false });

    if (error || !qs || qs.length === 0) {
        list.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i>এখানে কোনো প্রশ্ন নেই</div>';
        return;
    }

    lastLoadedQuestions = {};
    qs.forEach(q => { lastLoadedQuestions[q.id] = q; });

    list.innerHTML = qs.map((q) => {
        const canEdit = myRole.isAdmin || q.created_by === myUserId;
        return `
        <div class="q-item">
            <div class="q-text">${escapeHtml(q.question)}</div>
            <div class="q-meta">সঠিক: ${String.fromCharCode(65 + q.correct)} | অপশন: ${q.options.map(escapeHtml).join(' | ')}</div>
            <div class="q-actions">
                ${canEdit ? `
                    <button class="btn btn-warning btn-sm" onclick="editSupaQuestion(${q.id})"><i class="fas fa-edit"></i> এডিট</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSupaQuestion(${q.id})"><i class="fas fa-trash"></i> মুছুন</button>
                ` : '<span style="color:#999;font-size:0.8rem;">অন্যের যোগ করা প্রশ্ন</span>'}
            </div>
        </div>`;
    }).join('');
};

/* ================= এডিট ================= */

window.editSupaQuestion = async function (id) {
    let q = lastLoadedQuestions[id];

    if (!q) {
        const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
        if (error || !data) { toast('❌ প্রশ্ন লোড করা যায়নি!'); return; }
        q = data;
    }

    const tabs = document.querySelectorAll('.tab');
    const addTabBtn = Array.from(tabs).find(t => (t.getAttribute('onclick') || '').includes("'add'"));
    if (addTabBtn) switchTab('add', addTabBtn);

    document.getElementById('add-subject').value = q.subject_key || document.getElementById('manage-subject').value;

    const isModel = q.model_number !== null && q.model_number !== undefined;
    document.getElementById('add-mode').value = isModel ? 'model' : 'chapter';
    window.toggleAddMode();

    if (isModel) {
        document.getElementById('add-model-number').value = q.model_number;
    } else {
        fillChapterDropdown('add-subject', 'add-chapter');
        document.getElementById('add-chapter').value = q.chapter_index;
    }

    document.getElementById('add-question').value = q.question;
    document.getElementById('add-opt-a').value = q.options[0] || '';
    document.getElementById('add-opt-b').value = q.options[1] || '';
    document.getElementById('add-opt-c').value = q.options[2] || '';
    document.getElementById('add-opt-d').value = q.options[3] || '';
    document.getElementById('add-correct').value = q.correct;
    document.getElementById('add-explain').value = q.explanation || '';

    editingQuestionId = id;
    const saveBtn = document.getElementById('save-question-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> প্রশ্ন আপডেট করুন';

    toast('✏️ প্রশ্নটা এডিট করো, তারপর "প্রশ্ন আপডেট করুন" চাপো');
};

window.deleteSupaQuestion = async function (id) {
    if (!confirm('এই প্রশ্নটি মুছে ফেলবেন?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
        toast('❌ মুছতে সমস্যা হয়েছে! (এটা তোমার যোগ করা প্রশ্ন নাও হতে পারে)');
        return;
    }
    toast('🗑️ প্রশ্ন মুছে ফেলা হয়েছে');
    window.loadQuestionsList();
};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
