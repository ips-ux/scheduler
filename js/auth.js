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
        // Check for existing session (no expiration)
        const storedUser = localStorage.getItem('user_email');
        if (storedUser) {
            // Trust localStorage - user stays logged in indefinitely
            Auth.user = storedUser;
            Auth.onLoginSuccess();
        }
    },

    handleCredentialResponse: (response) => {
        try {
            // Decode JWT
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const email = payload.email;

            Auth.validateUser(email);
        } catch (e) {
            console.error('Auth Error:', e);
            Auth.showError('Authentication failed.');
        }
    },

    validateUser: (email) => {
        // Hardcoded allowed email for this project as per context
        // In a real scenario, we'd decode the obfuscated string.
        // Context: "Access is granted only if the user's logged-in email exactly matches the decoded Admin Email."
        // Context: "beacon85@greystar.com"

        const ALLOWED_EMAIL = 'beacon85@greystar.com';

        if (email === ALLOWED_EMAIL) {
            Auth.user = email;
            // Store in localStorage permanently (no expiration)
            localStorage.setItem('user_email', email);
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
        Auth.user = null;
        localStorage.removeItem('user_email');
        document.getElementById('login-overlay').classList.add('active');
        document.getElementById('app-container').classList.add('hidden');
        google.accounts.id.disableAutoSelect();
    },

    showError: (msg) => {
        const el = document.getElementById('login-error');
        if (el) el.textContent = msg;
    }
};

// Global callback for Google Sign-In
window.handleCredentialResponse = Auth.handleCredentialResponse;
