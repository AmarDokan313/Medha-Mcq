// auth.js
// এই ফাইলটা root ফোল্ডারে রাখবে, index.html এ app.js এর পরে টাইপ="module" দিয়ে যোগ করতে হবে

import { supabase } from './supabase-config.js';

let authMode = 'login'; // 'login' অথবা 'signup'

// লগিন/সাইনআপ মোড টগল করা
window.toggleAuthMode = function () {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const extra = document.getElementById('signup-extra-fields');
    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (authMode === 'signup') {
        extra.classList.remove('hidden');
        btn.textContent = 'সাইনআপ করো';
        toggleText.textContent = 'আগে থেকেই অ্যাকাউন্ট আছে? লগিন করো →';
    } else {
        extra.classList.add('hidden');
        btn.textContent = 'লগিন করুন';
        toggleText.textContent = 'নতুন? সাইনআপ করো →';
    }
};

// লগিন / সাইনআপ সাবমিট
window.handleAuthSubmit = async function () {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        showToast('ইমেইল ও পাসওয়ার্ড দিন!');
        return;
    }

    if (authMode === 'signup') {
        const name = document.getElementById('auth-name').value.trim();
        const branch = document.getElementById('auth-branch').value;

        if (!name || !branch) {
            showToast('নাম ও শাখা দিন!');
            return;
        }

        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            showToast('সাইনআপ ব্যর্থ: ' + error.message);
            return;
        }

        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                name: name,
                branch: branch
            });
        }

        showToast(`স্বাগতম ${name}! 🎉`);
        await window.loadUserProfile();
        showPage('home-page');

    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showToast('লগিন ব্যর্থ: ভুল ইমেইল বা পাসওয়ার্ড');
            return;
        }

        await window.loadUserProfile();
        showToast('লগিন সফল! 🎉');
        showPage('home-page');
    }
};

// ইউজারের প্রোফাইল ডাটাবেজ থেকে লোড করা
window.loadUserProfile = async function () {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profile) {
        const userObj = { name: profile.name, branch: profile.branch, phone: profile.phone || '' };
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        if (typeof updateUserUI === 'function') updateUserUI();
    }
};

// লগআউট (asli Supabase সেশনও শেষ হবে)
window.logout = async function () {
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    showPage('home-page');
    if (typeof updateUserUI === 'function') updateUserUI();
    showToast('লগআউট সফল!');
};

// পেজ লোড হলে আগে থেকে লগিন করা থাকলে সেশন চেক করা
window.addEventListener('load', () => {
    setTimeout(() => {
        window.loadUserProfile();
    }, 500);
});
