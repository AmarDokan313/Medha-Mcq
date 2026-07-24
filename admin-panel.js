// admin-panel.js
// এই ফাইলটা root ফোল্ডারে রাখবে (index.html, app.js, admin.html এর পাশে)
// admin.html এ data.js এর পরে <script type="module" src="admin-panel.js"></script> দিয়ে যোগ করা আছে

import { supabase } from './supabase-config.js';

let currentAdminProfile = null;

// ---------------- লগিন ----------------
window.adminSupabaseLogin = async function () {
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (!email || !pass) {
        errEl.textContent = '❌ ইমেইল ও পাসওয়ার্ড দিন!';
        errEl.style.display = 'block';
        return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
        errEl.textContent = '❌ ভুল ইমেইল বা পাসওয়ার্ড!';
        errEl.style.display = 'block';
        return;
    }

    await checkAdminAccess();
};

// প্রোফাইল চেক করে দেখা এডমিন/মডারেটর কিনা
async function checkAdminAccess() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || (!profile.is_admin && !profile.is_moderator)) {
        const errEl = document.getElementById('login-error');
        errEl.textContent = '❌ আপনার এডমিন/মডারেটর অনুমতি নেই!';
        errEl.style.display = 'block';
        await supabase.auth.signOut();
        return false;
    }

    currentAdminProfile = profile;
    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('admin-wrap').style.display = 'block';
    applyRoleUI();

    if (typeof window.initAdmin === 'function') window.initAdmin();
    loadNotifications();
    if (profile.is_admin) loadModerators();

    return true;
}

// ভূমিকা অনুযায়ী মেনু/বাটন দেখানো-লুকানো
function applyRoleUI() {
    const isAdmin = !!(currentAdminProfile && currentAdminProfile.is_admin);
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    const badge = document.getElementById('admin-role-badge');
    if (badge) badge.textContent = isAdmin ? '👑 এডমিন' : '🛡️ মডারেটর';
}

// পেজ লোড হলে আগে থেকে সেশন থাকলে অটো-লগিন চেক
window.addEventListener('load', () => {
    setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await checkAdminAccess();
    }, 300);
});

// ---------------- লগআউট ----------------
window.adminSupabaseLogout = async function () {
    await supabase.auth.signOut();
    location.reload();
};

// ---------------- নোটিফিকেশন ----------------
window.loadNotifications = async function () {
    const list = document.getElementById('notification-list');
    if (!list) return;

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        list.innerHTML = '<div class="empty"><i class="fas fa-bell-slash"></i>কোনো নোটিফিকেশন নেই</div>';
        return;
    }

    const groupNames = { all: 'সবাই', commerce: 'ব্যবসায় শাখা', science: 'বিজ্ঞান শাখা', humanities: 'মানবিক শাখা' };

    list.innerHTML = data.map(n => `
        <div class="q-item">
            <div class="q-text">${escapeHtml(n.message)}</div>
            <div class="q-meta">গ্রুপ: ${groupNames[n.target_group] || n.target_group} • ${new Date(n.created_at).toLocaleString('bn-BD')}</div>
            <div class="q-actions admin-only">
                <button class="btn btn-danger btn-sm" onclick="deleteNotification('${n.id}')"><i class="fas fa-trash"></i> মুছুন</button>
            </div>
        </div>
    `).join('');

    applyRoleUI();
};

window.createNotification = async function () {
    const message = document.getElementById('notif-message').value.trim();
    const group = document.getElementById('notif-group').value;

    if (!message) { toast('❌ মেসেজ লিখুন!'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast('❌ আগে লগিন করুন!'); return; }

    const { error } = await supabase.from('notifications').insert({
        message,
        target_group: group,
        created_by: session.user.id
    });

    if (error) {
        toast('❌ নোটিফিকেশন পাঠানো যায়নি: ' + error.message);
        return;
    }

    document.getElementById('notif-message').value = '';
    toast('✅ নোটিফিকেশন পাঠানো হয়েছে!');
    loadNotifications();
};

window.deleteNotification = async function (id) {
    if (!confirm('এই নোটিফিকেশন মুছে ফেলবেন?')) return;

    const { error } = await supabase.from('notifications').delete().eq('id', id);

    if (error) { toast('❌ মুছতে সমস্যা হয়েছে!'); return; }

    toast('✅ মুছে ফেলা হয়েছে!');
    loadNotifications();
};

// ---------------- মডারেটর ম্যানেজমেন্ট (শুধু এডমিন দেখবে) ----------------
window.loadModerators = async function () {
    const list = document.getElementById('moderator-list');
    if (!list) return;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, name, branch, is_admin, is_moderator')
        .order('name');

    if (error || !data) {
        list.innerHTML = '<div class="empty"><i class="fas fa-users-slash"></i>ইউজার লোড করা যায়নি</div>';
        return;
    }

    list.innerHTML = data.map(p => `
        <div class="q-item">
            <div class="q-text">${escapeHtml(p.name || 'নাম নেই')} ${p.is_admin ? '👑' : (p.is_moderator ? '🛡️' : '')}</div>
            <div class="q-meta">শাখা: ${escapeHtml(p.branch || '-')}</div>
            ${!p.is_admin ? `
            <div class="q-actions">
                <button class="btn ${p.is_moderator ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleModerator('${p.id}', ${!p.is_moderator})">
                    <i class="fas fa-shield-alt"></i> ${p.is_moderator ? 'মডারেটর বাতিল' : 'মডারেটর বানাও'}
                </button>
            </div>` : '<div class="q-meta" style="color:#999;">(এডমিন — পরিবর্তন করা যাবে না)</div>'}
        </div>
    `).join('');
};

window.toggleModerator = async function (userId, makeMod) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_moderator: makeMod })
        .eq('id', userId);

    if (error) { toast('❌ পরিবর্তন করা যায়নি!'); return; }

    toast(makeMod ? '✅ মডারেটর বানানো হয়েছে!' : '✅ মডারেটর বাতিল হয়েছে!');
    loadModerators();
};

// ---------------- পাসওয়ার্ড পরিবর্তন ----------------
window.changeSupabasePassword = async function () {
    const newP = document.getElementById('new-pass').value;

    if (!newP || newP.length < 6) { toast('❌ কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন!'); return; }

    const { error } = await supabase.auth.updateUser({ password: newP });

    if (error) { toast('❌ পরিবর্তন ব্যর্থ: ' + error.message); return; }

    document.getElementById('new-pass').value = '';
    toast('✅ পাসওয়ার্ড পরিবর্তন হয়েছে!');
};

// ---------------- সাহায্যকারী ফাংশন ----------------
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
