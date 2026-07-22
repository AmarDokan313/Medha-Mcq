// Medha MCQ - অফলাইন পড়ার জন্য Service Worker
const CACHE_NAME = 'medha-mcq-v1';
const OFFLINE_FILES = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './data.js'
];

// ইনস্টলের সময় সব ফাইল ক্যাশে সংরক্ষণ করা হয়
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(OFFLINE_FILES);
        }).then(() => self.skipWaiting())
    );
});

// পুরনো ক্যাশ মুছে ফেলা হয় নতুন ভার্শন এলে
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// আগে ক্যাশ থেকে দেখানো হয়, না থাকলে নেটওয়ার্ক থেকে আনা হয় (এবং ক্যাশে সংরক্ষণ করা হয়)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // শুধু নিজের সাইটের ফাইল ক্যাশে রাখা হয়
                if (event.request.url.startsWith(self.location.origin)) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // ইন্টারনেট না থাকলে ও ক্যাশেও না থাকলে হোমপেজ দেখানো হয়
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
