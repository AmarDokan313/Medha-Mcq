// firebase-config.js
// এই ফাইলটা তোমার index.html এবং admin.html এর সাথে একই ফোল্ডারে (root এ) রাখবে

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1gAL7dI4VAzaW67yVTCIYCEioxLpC8Cg",
  authDomain: "medhamcq-du.firebaseapp.com",
  projectId: "medhamcq-du",
  storageBucket: "medhamcq-du.firebasestorage.app",
  messagingSenderId: "593898945516",
  appId: "1:593898945516:web:3f9a559b5f4d1a76b41ec9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
