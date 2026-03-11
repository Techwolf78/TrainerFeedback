import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where
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
 * Get all system users
 */
export const getAllSystemUsers = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isDeleted', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

/**
 * Get users by role
 */
export const getUsersByRole = async (role) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('role', '==', role),
      where('isDeleted', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error getting users by role ${role}:`, error);
    throw error;
  }
};
