// --- Firebase Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyB6bBY99Jt507YdRiYLaM77k-AZGOv56XM",
    authDomain: "statsmvg.firebaseapp.com",
    projectId: "statsmvg",
    storageBucket: "statsmvg.firebasestorage.app",
    messagingSenderId: "605661495564",
    appId: "1:605661495564:web:34636c9b7a598d49114929",
    measurementId: "G-WTJVL9J96C"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
firestore.enablePersistence({ synchronizeTabs: true })
    .catch(err => console.warn("Firestore persistence disabled:", err.code));

