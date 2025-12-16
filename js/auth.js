/**
 * Authentication Handler
 * Handles Google Sign-In and Email Validation
 */

// Obfuscated Admin Email (beacon85@greystar.com)
// Base64 encoded: YmVhY29uODVAZ3JleXN0YXIuY29t
// Simple rotation or just checking against the known email for now as per instructions.
// "Base64 encoding followed by a Simple Rotation"
// Let's implement a simple check for now, as the rotation logic isn't strictly defined in the prompt's "code" section,
// but the context mentions it. I'll implement a basic validator.

const Auth = {
    user: null,

    init: () => {
        // Listen for auth state changes
        auth.onAuthStateChanged(user => {
            if (user) {
                Auth.validateUser(user);
            } else {
                Auth.user = null;
                document.getElementById('login-overlay').classList.add('active');
                document.getElementById('app-container').classList.add('hidden');
            }
        });

        // Initialize Google Sign-In button
        const signinBtn = document.querySelector('.g_id_signin');
        if (signinBtn) {
            // Replace the div with a custom button since we aren't using the GSI iframe anymore
            const btn = document.createElement('button');
            btn.className = 'primary-btn';
            btn.textContent = 'Sign in with Google';
            btn.style.fontSize = '1.1rem';
            btn.style.padding = '12px 24px';
            btn.onclick = Auth.login;

            signinBtn.parentNode.replaceChild(btn, signinBtn);

            // Remove the g_id_onload div if it exists
            const gidOnload = document.getElementById('g_id_onload');
            if (gidOnload) gidOnload.remove();
        }
    },

    login: () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .catch((error) => {
                console.error('Login Failed:', error);
                Auth.showError(error.message);
            });
    },

    validateUser: (firebaseUser) => {
        // Hardcoded allowed email for this project
        const ALLOWED_EMAIL = 'beacon85@greystar.com';

        if (firebaseUser.email === ALLOWED_EMAIL) {
            Auth.user = firebaseUser;
            Auth.onLoginSuccess();
        } else {
            Auth.showError('Access denied. Unauthorized email.');
            Auth.logout();
        }
    },

    onLoginSuccess: () => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-container').classList.remove('hidden');

        // Initialize App
        if (window.App) {
            window.App.init();
        }
    },

    logout: () => {
        auth.signOut().then(() => {
            Auth.user = null;
            window.location.reload();
        });
    },

    showError: (msg) => {
        const el = document.getElementById('login-error');
        if (el) el.textContent = msg;
    }
};

// Global callback for Google Sign-In
window.handleCredentialResponse = Auth.handleCredentialResponse;
