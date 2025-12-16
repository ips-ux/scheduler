// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjaqIfSrorLTCLUQQjEAt3lkYyyo6h8dw",
    authDomain: "ips-ux-scheduler.firebaseapp.com",
    projectId: "ips-ux-scheduler",
    storageBucket: "ips-ux-scheduler.firebasestorage.app",
    messagingSenderId: "24939687104",
    appId: "1:24939687104:web:d020687cf7cb9fd7271125",
    measurementId: "G-4KBZ1MJGLK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

// Set auth persistence to LOCAL (persists across browser sessions)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Firebase Auth persistence set to LOCAL');
        // Initialize Auth after persistence is set
        if (window.Auth) {
            Auth.init();
        }
    })
    .catch((error) => {
        console.error('Error setting auth persistence:', error);
        // Still try to initialize even if persistence fails
        if (window.Auth) {
            Auth.init();
        }
    });

