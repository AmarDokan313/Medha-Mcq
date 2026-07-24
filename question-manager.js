// question-manager.js
// এডমিন/মডারেটরের জন্য Supabase-ভিত্তিক প্রশ্ন যোগ/এডিট/মুছার সিস্টেম
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
});

// subject/chapter select বদলালে নতুন প্রশ্ন তালিকা লোড হবে (পুরনো onchange="loadQuestionsList()" এটাই কল করবে)

// প্রশ্ন যোগ / আপডেট — পুরনো লোকাল addQuestion() ওভাররাইড করা হলো
window.addQuestion = async function () {
    await loadMyRole();

    const subj = document.getElementById('add-subject').value;
    const chap = parseInt(document.getElementById('add-chapter').value);
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
        chapter_index: chap,
        question: q,
        options: [a, b, c, d],
        correct: correct,
        explanation: explain || 'ব্যাখ্যা শীঘ্রই যোগ হবে।'
    };

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

// প্রশ্নের তালিকা — Supabase থেকে (পুরনো লোকাল loadQuestionsList() ওভাররাইড করা হলো)
window.loadQuestionsList = async function () {
    const subjSel = document.getElementById('manage-subject');
    const chapSel = document.getElementById('manage-chapter');
    if (!subjSel || !chapSel || !subjSel.value) return;

    const subj = subjSel.value;
    const chap = parseInt(chapSel.value);
    const list = document.getElementById('questions-list');
    if (!list) return;

    await loadMyRole();

    const { data: qs, error } = await supabase
        .from('questions')
        .select('id, question, options, correct, explanation, created_by')
        .eq('subject_key', subj)
        .eq('chapter_index', chap)
        .order('created_at', { ascending: false });

    if (error || !qs || qs.length === 0) {
        list.innerHTML = '<div class="empty"><i class="fas fa-inbox"></i>এই অধ্যায়ে কোনো প্রশ্ন নেই</div>';
        return;
    }

    list.innerHTML = qs.map((q) => {
        const canEdit = myRole.isAdmin || q.created_by === myUserId;
        return `
        <div class="q-item">
            <div class="q-text">${escapeHtml(q.question)}</div>
            <div class="q-meta">সঠিক: ${String.fromCharCode(65 + q.correct)} | অপশন: ${q.options.map(escapeHtml).join(' | ')}</div>
            <div class="q-actions">
                ${canEdit ? `
                    <button class="btn btn-warning btn-sm" onclick="editSupaQuestion(${q.id}, '${subj}', ${chap})"><i class="fas fa-edit"></i> এডিট</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSupaQuestion(${q.id})"><i class="fas fa-trash"></i> মুছুন</button>
                ` : '<span style="color:#999;font-size:0.8rem;">অন্যের যোগ করা প্রশ্ন</span>'}
            </div>
        </div>`;
    }).join('');
};

// এডিট বাটনে ক্লিক করলে "প্রশ্ন যোগ" ট্যাবে ফর্ম পূরণ হয়ে যাবে
window.editSupaQuestion = async function (id, subj, chap) {
    const { data: q, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !q) { toast('❌ প্রশ্ন লোড করা যায়নি!'); return; }

    const tabs = document.querySelectorAll('.tab');
    const addTabBtn = Array.from(tabs).find(t => (t.getAttribute('onclick') || '').includes("'add'"));
    if (addTabBtn) switchTab('add', addTabBtn);

    document.getElementById('add-subject').value = subj;
    fillChapterDropdown('add-subject', 'add-chapter');
    document.getElementById('add-chapter').value = chap;
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
