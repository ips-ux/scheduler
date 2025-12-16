/**
 * Authentication Handler
 * Handles Google Sign-In and Email Validation
 */

const Auth = {
    user: null,
    credential: null, // Store OAuth credential for Gmail API
    authInitialized: false, // Track if initial auth check is complete

    init: () => {
        console.log('Auth.init() called');

        // Listen for auth state changes
        auth.onAuthStateChanged(user => {
            console.log('onAuthStateChanged fired, user:', user ? user.email : 'null', 'initialized:', Auth.authInitialized);

            if (user) {
                Auth.validateUser(user);
            } else {
                // CRITICAL FIX: Only show login screen if auth has been initialized
                // This prevents kicking out users while Firebase is still checking for existing session
                if (Auth.authInitialized) {
                    console.log('No user found after initialization, showing login');
                    Auth.user = null;
                    const loginOverlay = document.getElementById('login-overlay');
                    const appContainer = document.getElementById('app-container');
                    if (loginOverlay) loginOverlay.classList.add('active');
                    if (appContainer) appContainer.classList.add('hidden');
                } else {
                    console.log('Auth not yet initialized, waiting for Firebase to check session...');
                }
            }

            // Mark auth as initialized after first check
            if (!Auth.authInitialized) {
                Auth.authInitialized = true;
                console.log('Auth initialization complete');
            }
        });

        // Try to restore OAuth credential from localStorage
        try {
            const storedCred = localStorage.getItem('gmail_oauth_token');
            if (storedCred) {
                Auth.credential = { accessToken: storedCred };
                console.log('Restored OAuth credential from storage');
            }
        } catch (e) {
            console.warn('Could not restore OAuth credential:', e);
        }

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
        // Add Gmail send scope to allow sending emails
        provider.addScope('https://www.googleapis.com/auth/gmail.send');
        auth.signInWithPopup(provider)
            .then((result) => {
                // Store the OAuth credential for Gmail API access
                Auth.credential = result.credential;

                // Persist access token to localStorage
                if (result.credential && result.credential.accessToken) {
                    try {
                        localStorage.setItem('gmail_oauth_token', result.credential.accessToken);
                        console.log('Login successful, OAuth credential stored');
                    } catch (e) {
                        console.warn('Could not store OAuth credential:', e);
                    }
                }
            })
            .catch((error) => {
                console.error('Login Failed:', error);
                Auth.showError(error.message);
            });
    },

    validateUser: (firebaseUser) => {
        console.log('Validating user:', firebaseUser.email);
        // Allow any @greystar.com email
        const ALLOWED_DOMAIN = '@greystar.com';

        if (firebaseUser.email && firebaseUser.email.endsWith(ALLOWED_DOMAIN)) {
            console.log('User validated successfully:', firebaseUser.email);
            Auth.user = firebaseUser;
            Auth.onLoginSuccess();
        } else {
            console.error('User validation failed:', firebaseUser.email);
            Auth.showError('Access denied. Only @greystar.com emails are allowed.');
            Auth.logout();
        }
    },

    onLoginSuccess: () => {
        console.log('Login success, initializing app...');
        const loginOverlay = document.getElementById('login-overlay');
        const appContainer = document.getElementById('app-container');

        if (loginOverlay) {
            loginOverlay.classList.remove('active');
        } else {
            console.error('login-overlay element not found!');
        }

        if (appContainer) {
            appContainer.classList.remove('hidden');
        } else {
            console.error('app-container element not found!');
        }

        // Initialize App
        if (window.App) {
            console.log('Initializing App...');
            window.App.init();
        } else {
            console.error('App object not found!');
        }
    },

    logout: () => {
        auth.signOut().then(() => {
            Auth.user = null;
            Auth.credential = null;
            Auth.authInitialized = false; // Reset initialization flag
            // Clear stored OAuth token
            try {
                localStorage.removeItem('gmail_oauth_token');
            } catch (e) {
                console.warn('Could not clear OAuth credential:', e);
            }
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

// Initialize Auth when this script loads
// Wait for DOM to be ready first
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM ready, initializing Auth...');
        Auth.init();
    });
} else {
    // DOM already loaded
    console.log('DOM already ready, initializing Auth...');
    Auth.init();
}
