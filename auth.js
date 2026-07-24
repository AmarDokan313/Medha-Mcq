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
        window.loadNotifications();
    }, 500);
});

// ============================================
// নোটিফিকেশন ব্যানার
// ============================================

// টেক্সটের মধ্যে থাকা যেকোনো লিংককে ক্লিকযোগ্য <a> ট্যাগে রূপান্তর
function linkifyText(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;

    return escaped.replace(urlRegex, (match) => {
        let href = match;
        if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    });
}

// ইউজার আগে যেসব নোটিফিকেশন বন্ধ করে দিয়েছে তার তালিকা
function getDismissedNotifIds() {
    try {
        return JSON.parse(localStorage.getItem('dismissedNotifs') || '[]');
    } catch (e) {
        return [];
    }
}

function dismissNotif(id) {
    const dismissed = getDismissedNotifIds();
    if (!dismissed.includes(id)) dismissed.push(id);
    localStorage.setItem('dismissedNotifs', JSON.stringify(dismissed));
    const el = document.getElementById('notif-' + id);
    if (el) el.remove();
}
window.dismissNotif = dismissNotif;

// হোমপেজে প্রাসঙ্গিক নোটিফিকেশন লোড ও দেখানো
window.loadNotifications = async function () {
    const area = document.getElementById('notif-banner-area');
    if (!area) return;

    const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !notifs) return;

    let myBranch = null;
    try {
        const stored = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (stored && stored.branch) myBranch = stored.branch;
    } catch (e) {}

    const dismissed = getDismissedNotifIds();

    const relevant = notifs.filter(n => {
        if (dismissed.includes(n.id)) return false;
        if (!n.target_group || n.target_group === 'all') return true;
        return n.target_group === myBranch;
    });

    area.innerHTML = relevant.map(n => `
        <div class="notif-banner" id="notif-${n.id}">
            <span class="notif-icon">📢</span>
            <span class="notif-text">${linkifyText(n.message || '')}</span>
            <button class="notif-close" onclick="dismissNotif(${JSON.stringify(n.id)})" title="বন্ধ করো">✕</button>
        </div>
    `).join('');
};
