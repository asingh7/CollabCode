/**
 * Firebase SDK Configuration
 * 
 * SECURITY NOTE:
 * - Firebase API keys are designed to be public and included in client-side code
 * - Security is enforced through Firebase Security Rules (database.rules.secure.json)
 * - These keys only identify your project, they don't grant access
 * - Access control is managed by:
 *   1. Database Security Rules (configured in Firebase Console)
 *   2. Authentication (handled by our backend API)
 *   3. CORS settings and domain restrictions
 * 
 * For additional security:
 * - Database rules restrict access to authenticated users only
 * - Admin functions require JWT tokens from our backend
 * - Consider enabling App Check for additional client verification
 */

// Initialize Firebase with public configuration
// These are CLIENT-SIDE keys that are safe to expose
// IMPORTANT: Replace these with your own Firebase project configuration
var config = {
  apiKey: "AIzaSyBNMJDM_2w66_oHTXgzj_0Y5qunKZn7g38",
  authDomain: "opencollab-b1d87.firebaseapp.com",
  databaseURL: "https://opencollab-b1d87-default-rtdb.firebaseio.com",
  storageBucket: "opencollab-b1d87.firebasestorage.app",
  messagingSenderId: "841259111185",
  projectId: "opencollab-b1d87",
  appId: "1:841259111185:web:8a3878254dce4de51932b0"
};

// Initialize Firebase
try {
  firebase.initializeApp(config);
  console.log('✅ Firebase initialized');
  
  // Monitor connection status
  firebase.database().ref('.info/connected').on('value', function(snapshot) {
    if (snapshot.val() === true) {
      console.log('✅ Firebase connected');
    } else {
      console.warn('⚠️ Firebase disconnected - check your internet connection');
    }
  });
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

// Security reminder for developers
if (window.location.hostname === 'localhost') {
  console.info(
    '%c⚠️ Security Reminder',
    'background: yellow; color: black; padding: 5px;',
    '\nFirebase config is public by design. Security is enforced through:\n' +
    '1. Database Security Rules (database.rules.secure.json)\n' +
    '2. Backend authentication (Vercel API)\n' +
    '3. Never store sensitive data in client-side code\n' +
    '4. Use environment variables for server-side secrets only'
  );
}
