// question-sync.js
// Supabase-এর 'questions' টেবিল থেকে সব প্রশ্ন লোড করে সাইটের subjectData-তে বসিয়ে দেয়
// এখন মডেল টেস্টের প্রশ্নও window.modelTestData তে লোড হয়
// এডমিন/মডারেটর কোনো প্রশ্ন যোগ/এডিট/মুছলে সাথে সাথেই এখানে প্রতিফলিত হবে
// এই ফাইলটা root ফোল্ডারে রাখবে (notif ব্যানার সিস্টেম auth.js এ আলাদা আছে, এটা শুধু প্রশ্নের জন্য)

import { supabase } from './supabase-config.js';

window.modelTestData = {}; // { subjectKey: { modelNumber: [questions...] } }

window.addEventListener('load', () => {
    setTimeout(syncQuestionsFromSupabase, 300);
});

async function syncQuestionsFromSupabase() {
    if (!window.subjectData) return;

    const { data: rows, error } = await supabase
        .from('questions')
        .select('id, subject_key, chapter_index, chapter_name, model_number, question, options, correct, explanation');

    if (error || !rows) return;

    // অধ্যায়ভিত্তিক প্রশ্ন subject_key + chapter_index অনুযায়ী গ্রুপ করা
    const grouped = {};
    // মডেল টেস্টের প্রশ্ন subject_key + model_number অনুযায়ী গ্রুপ করা
    const modelGrouped = {};
    // প্রতিটা subject_key|chapter_index এর জন্য Supabase-এ সেভ করা আসল অধ্যায়ের নাম
    const chapterNames = {};

    rows.forEach(r => {
        const q = {
            id: r.id,
            question: r.question,
            options: r.options,
            correct: r.correct,
            explanation: r.explanation || 'ব্যাখ্যা শীঘ্রই যোগ হবে।'
        };

        if (r.model_number !== null && r.model_number !== undefined) {
            if (!modelGrouped[r.subject_key]) modelGrouped[r.subject_key] = {};
            if (!modelGrouped[r.subject_key][r.model_number]) modelGrouped[r.subject_key][r.model_number] = [];
            modelGrouped[r.subject_key][r.model_number].push(q);
        } else if (r.chapter_index !== null && r.chapter_index !== undefined) {
            const key = r.subject_key + '|' + r.chapter_index;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(q);
            if (r.chapter_name && r.chapter_name.trim()) {
                chapterNames[key] = r.chapter_name.trim();
            }
        }
    });

    Object.keys(grouped).forEach(key => {
        const sep = key.lastIndexOf('|');
        const subj = key.slice(0, sep);
        const idx = parseInt(key.slice(sep + 1));

        if (!window.subjectData[subj]) return; // বিষয়টাই না থাকলে স্কিপ

        const chapters = window.subjectData[subj].chapters;

        // ইনডেক্স পর্যন্ত অধ্যায় না থাকলে খালি অধ্যায় তৈরি করে ফাঁক পূরণ করা
        while (chapters.length <= idx) {
            chapters.push({
                id: chapters.length + 1,
                name: 'অধ্যায় ' + (chapters.length + 1),
                questionCount: 0,
                questions: []
            });
        }

        // Supabase-এ আসল অধ্যায়ের নাম দেওয়া থাকলে সেটাই ব্যবহার করা (নতুন বা পুরনো, দুটোতেই)
        if (chapterNames[key]) {
            chapters[idx].name = chapterNames[key];
        }

        chapters[idx].questions = grouped[key];
        chapters[idx].questionCount = grouped[key].length;
    });

    // এডমিন প্যানেলের ড্রপডাউন বা অন্য UI যদি এই ইভেন্ট শোনে, রিফ্রেশ করার সুযোগ পাবে
    window.dispatchEvent(new CustomEvent('subjectDataSynced'));

    window.modelTestData = modelGrouped;

    // মডেল টেস্ট লোড হয়ে গেলে জানিয়ে দেওয়া, যাতে খোলা থাকা মডেল-লিস্ট পেজ থাকলে রিফ্রেশ হয়
    window.dispatchEvent(new CustomEvent('modelTestDataReady'));
}
