// প্রিমিয়াম স্ট্যাটাস চেক করার জন্য পরিবর্তনশীল
let isUserPremium = false;

// পেজ পরিবর্তন করার ফাংশন
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.remove('hidden');
    }
}

// বিষয় দেখানোর ফাংশন
function showSubject(subjectKey) {
    showToast(`📚 '${subjectKey.toUpperCase()}' বিষয়ের প্রশ্ন খোলা হচ্ছে...`);
    // এখানে আপনার বিষয় খুলবে বা প্রশ্ন দেখানোর লজিক চলবে
}

// প্রিমিয়াম একটিভ কি না তা যাচাই করার ফাংশন
window.isPremiumActive = function() {
    return isUserPremium || localStorage.getItem('hsc_premium_user') === 'true';
};

// প্রিমিয়াম পেজ থেকে বিষয় খোলার ফাংশন
window.openPremiumSubject = function(subjectKey) {
    if (window.isPremiumActive()) {
        showPage('home-page');
        showSubject(subjectKey);
    } else {
        showToast('❌ এই বিষয় পড়তে প্রিমিয়াম আনলক কোড ব্যবহার করো অথবা পেমেন্ট করো!');
        
        // কোড বসানোর জায়গায় স্ক্রোল করানো
        const unlockCard = document.getElementById('unlock-code-card');
        if (unlockCard) {
            unlockCard.scrollIntoView({ behavior: 'smooth' });
        }
    }
};

// কোড দিয়ে প্রিমিয়াম সক্রিয় করার ফাংশন
function activateCode() {
    const codeInput = document.getElementById('premium-key-input').value.trim();
    
    // উদাহরণস্বরূপ টেস্ট কোড: HSC2026
    if (codeInput === "HSC2026" || codeInput === "1234") {
        isUserPremium = true;
        localStorage.setItem('hsc_premium_user', 'true');
        showToast('🎉 অভিনন্দন! প্রিমিয়াম সফলভাবে চালু হয়েছে।');
        document.getElementById('premium-key-input').value = '';
    } else if (codeInput === "") {
        showToast('⚠️ অনুগ্রহ করে একটি কোড লিখুন!');
    } else {
        showToast('❌ ভুল কোড! সঠিক কোড ব্যবহার করুন।');
    }
}

// মেসেজ দেখানোর (Toast) ফাংশন
function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.innerText = message;
        toast.className = "show";
        setTimeout(function() { 
            toast.className = toast.className.replace("show", ""); 
        }, 3000);
    } else {
        alert(message);
    }
}
