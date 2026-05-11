import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { createUserWithoutLoggingIn } from '../authService';
import { sendAdminOnboardingEmail, sendSuperAdminOnboardingEmail } from '../emailJsService';

const COLLECTION_NAME = 'users';

/**
 * Creates a new System User (Superadmin or College Admin)
 * 1. Creates Auth user via secondary app
 * 2. Creates Firestore document in 'users' collection
 */
export const createSystemUser = async (userData, password) => {
  const { email, role, name, collegeId } = userData;

  try {
    // 1. Create Auth User
    const uid = await createUserWithoutLoggingIn(email, password);

    // 2. Create Firestore Document
    // Using UID as the document ID for easy lookup
    await setDoc(doc(db, COLLECTION_NAME, uid), {
      uid,
      email,
      role,
      name,
      collegeId: collegeId || null,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Send Onboarding Email for College Admins
    if (role === 'collegeAdmin') {
      await sendAdminOnboardingEmail({
        name,
        email,
        temporary_password: password
      });
    }

    // Send Onboarding Email for Superadmins
    if (role === 'superAdmin') {
      await sendSuperAdminOnboardingEmail({
        name,
        email,
        temporary_password: password
      });
    }

    return { uid, ...userData };
  } catch (error) {
    console.error('Error creating system user:', error);
    throw error;
  }
};

/**
 * Update an existing user's Firestore data
 * (Cannot update Auth email/password here without logging in as them)
 */
export const updateSystemUser = async (uid, updates) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { uid, ...updates };
  } catch (error) {
    console.error('Error updating system user:', error);
    throw error;
  }
};

/**
 * Soft delete a system user
 * Sets isDeleted flag to true instead of removing the document.
 * AuthContext checks this flag and blocks login for deleted users.
 */
export const deleteSystemUser = async (uid) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error soft-deleting system user:', error);
    throw error;
  }
};

/**
 * Get all system users (excluding soft-deleted ones)
 * Handles both old users (without isDeleted field) and new users (with field)
 */
export const getAllSystemUsers = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Include documents that either:
        // 1. Don't have isDeleted field (legacy users)
        // 2. Have isDeleted field set to false
        return data.isDeleted !== true;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

/**
 * Get users by role (excluding soft-deleted ones)
 * Handles both old users (without isDeleted field) and new users (with field)
 */
export const getUsersByRole = async (role) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('role', '==', role)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Include documents that either:
        // 1. Don't have isDeleted field (legacy users)
        // 2. Have isDeleted field set to false
        return data.isDeleted !== true;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  } catch (error) {
    console.error(`Error getting users by role ${role}:`, error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates of all system users (excluding soft-deleted ones)
 * Returns an unsubscribe function
 */
export const subscribeToAdmins = (callback) => {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const admins = querySnapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Include documents that either:
          // 1. Don't have isDeleted field (legacy users)
          // 2. Have isDeleted field set to false
          return data.isDeleted !== true;
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      callback(admins);
    }, (error) => {
      console.error('Error subscribing to admins:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up admins subscription:', error);
    throw error;
  }
};

/**
 * Update another user's password (SuperAdmin only via Cloud Function)
 * This requires a Cloud Function with admin access to be deployed.
 * 
 * If the Cloud Function is not available, returns an error message
 * with instructions for setup.
 */
export const updateAdminPassword = async (uid, newPassword) => {
  try {
    // Call Cloud Function to update password
    // Format: https://us-central1-{projectId}.cloudfunctions.net/updateUserPassword
    const projectId = 'trainer-feedback-f59f0';
    const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/updateUserPassword`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        newPassword,
      }),
    });

    if (!response.ok) {
      // If 404, Cloud Function not found
      if (response.status === 404) {
        throw new Error(
          'Cloud Function not deployed. Please deploy the updateUserPassword Cloud Function to enable direct password updates.'
        );
      }
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}: Failed to update password`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating admin password:', error);
    throw error;
  }
};
