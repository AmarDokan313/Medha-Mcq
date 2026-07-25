// question-sync.js
// Supabase-এর 'questions' টেবিল থেকে সব প্রশ্ন লোড করে সাইটের subjectData-তে বসিয়ে দেয়
// এডমিন/মডারেটর কোনো প্রশ্ন যোগ/এডিট/মুছলে সাথে সাথেই এখানে প্রতিফলিত হবে
// এই ফাইলটা root ফোল্ডারে রাখবে (notif ব্যানার সিস্টেম auth.js এ আলাদা আছে, এটা শুধু প্রশ্নের জন্য)

import { supabase } from './supabase-config.js';

window.addEventListener('load', () => {
    setTimeout(syncQuestionsFromSupabase, 300);
});

async function syncQuestionsFromSupabase() {
    if (!window.subjectData) return;

    const { data: rows, error } = await supabase
        .from('questions')
        .select('id, subject_key, chapter_index, question, options, correct, explanation');

    if (error || !rows) return;

    // subject_key + chapter_index অনুযায়ী গ্রুপ করা
    const grouped = {};
    rows.forEach(r => {
        const key = r.subject_key + '|' + r.chapter_index;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
            id: r.id,
            question: r.question,
            options: r.options,
            correct: r.correct,
            explanation: r.explanation || 'ব্যাখ্যা শীঘ্রই যোগ হবে।'
        });
    });

    Object.keys(window.subjectData).forEach(subj => {
        window.subjectData[subj].chapters.forEach((ch) => {
            const key = subj + '|' + ch.id;
            if (grouped[key]) {
                ch.questions = grouped[key];
                ch.questionCount = grouped[key].length;
            }
        });
    });
}
