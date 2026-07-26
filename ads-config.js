// ============================================
// বিজ্ঞাপন কনফিগারেশন — এখানে বিজ্ঞাপনের ভিডিও/কোড বসানো আছে
// ============================================
//
// নিয়ম:
// - একাধিক বিজ্ঞাপন (ads তালিকায়) পরপর দেখানো হবে
// - প্রতিটা বিজ্ঞাপনের duration = কত সেকেন্ড পর "বন্ধ করুন" বাটন/পরের বিজ্ঞাপন আসবে
// - ads তালিকা খালি ([]) রাখলে কোনো বিজ্ঞাপন দেখানো হবে না,
//   ব্যবহারকারীরা সাথে সাথেই "বন্ধ করুন" বাটন পাবে
//
// নতুন ভিডিও যোগ করতে চাইলে ঠিক এই ফরম্যাটে ads তালিকায় আরেকটা { html: '...', duration: সংখ্যা } যোগ করবে

const adConfig = {
    // এই তারিখের পর সব বিজ্ঞাপন বন্ধ হয়ে যাবে (ফাঁকা রাখলে মেয়াদ শেষ হবে না)
    expiry: '',

    ads: [
        {
            // YouTube ভিডিও — ১৫ সেকেন্ড পর স্কিপ করা যাবে
            html: '<iframe width="100%" height="220" src="https://www.youtube.com/embed/hjH4uMP0mEw?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>',
            duration: 15
        },
        {
            // Facebook ভিডিও — ৭ সেকেন্ডের, পুরোটা দেখানোর পর স্কিপ করা যাবে
            html: '<iframe width="100%" height="280" src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fr%2F1CCMQM5S7n%2F&autoplay=true" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>',
            duration: 7
        }
    ]
};
