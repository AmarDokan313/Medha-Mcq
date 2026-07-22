// ============================================
// বিজ্ঞাপন কনফিগারেশন — এডমিন এখানে বিজ্ঞাপনের কোড/ভিডিও বসাবে
// ============================================
//
// কীভাবে ব্যবহার করবে:
// ১. নিচের adConfig.html এর ভেতরের quotation mark ("...") এর মধ্যে
//    তোমার বিজ্ঞাপনের কোড বা ভিডিও লিংক বসাও।
// ২. এই ফাইলটা GitHub-এ commit করলেই সব ভিজিটরের কাছে নতুন বিজ্ঞাপন দেখাবে।
//
// উদাহরণ ১ — ইউটিউব ভিডিও বিজ্ঞাপন:
//   html: '<iframe width="100%" height="200" src="https://www.youtube.com/embed/ভিডিও_আইডি?autoplay=1" frameborder="0" allow="autoplay" allowfullscreen></iframe>'
//
// উদাহরণ ২ — নিজের আপলোড করা ভিডিও (mp4 লিংক):
//   html: '<video width="100%" controls autoplay><source src="তোমার_ভিডিও_লিংক.mp4" type="video/mp4"></video>'
//
// উদাহরণ ৩ — কোনো নেটওয়ার্কের দেওয়া বিজ্ঞাপন কোড (ছবি/ব্যানার):
//   html: '<a href="https://sponsor-website.com" target="_blank"><img src="https://sponsor-image-link.jpg" style="width:100%"></a>'
//
// ⚠️ গুরুত্বপূর্ণ: Google AdSense-এর মতো নেটওয়ার্ক যদি <script> ট্যাগ দেয়,
// সেটা এখানে কাজ করবে না — সেক্ষেত্রে আমাকে আলাদাভাবে বলো, index.html-এর
// <head> অংশে বসাতে হবে।

const adConfig = {
    html: '<div class="fake-ad">📢 বিজ্ঞাপন</div>'
};
