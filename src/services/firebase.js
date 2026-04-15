import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Environment-aware configuration
// For manual GoDaddy deployment, ensure you are running 'npm run build'
const isDevelopment = import.meta.env.MODE === 'development';

const devConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY_DEV || 'AIzaSyAM2AEpZ88qWp7WZViN3YhDesefNfv067U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_DEV || 'training-feedback-system.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID_DEV || 'training-feedback-system',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_DEV || 'training-feedback-system.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID_DEV || '736979139967',
  appId: import.meta.env.VITE_FIREBASE_APP_ID_DEV || '1:736979139967:web:f587745574eeaad6a6ae4a',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID_DEV || 'G-5F5D7FWSNT'
};

const prodConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCdRbGZVROkMOt5QaFQSSB1dQnz5waQlkw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'trainer-feedback-f59f0.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trainer-feedback-f59f0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'trainer-feedback-f59f0.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '978849822812',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:978849822812:web:1de5014f1ddc802e1b8e99',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-W0MK9LDYYJ'
};

// Use dev config during 'npm run dev', prod config for 'npm run build'
const firebaseConfig = isDevelopment ? devConfig : prodConfig;

// Simple check to see if config is loaded
const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('Missing Firebase configuration keys:', missingKeys);
  console.error('Please check your .env.local file and restart the development server.');
}

let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { app, auth, db };
