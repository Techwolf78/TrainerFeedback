import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to fetch user role and data from Firestore
  const fetchUserRoleAndData = async (firebaseUser) => {
    try {
      // 1. Check 'trainers' collection first (avoids permission issues on 'users' for trainers)
      const trainerDocRef = doc(db, 'trainers', firebaseUser.uid);
      const trainerDocSnap = await getDoc(trainerDocRef);

      if (trainerDocSnap.exists()) {
        const trainerData = trainerDocSnap.data();

        // Block soft-deleted trainers
        if (trainerData.isDeleted === true) {
          await signOut(auth);
          return { isDeleted: true };
        }

        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: 'trainer',
          ...trainerData
        };
      }

      // 2. Check 'users' collection (Superadmin / College Admin)
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        // Block soft-deleted users
        if (userData.isDeleted === true) {
          await signOut(auth);
          return { isDeleted: true };
        }

        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role, // 'superAdmin' or 'collegeAdmin'
          ...userData
        };
      }

      // Fallback: If not found in either, return basic auth info (Roleless)
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: 'guest'
      };

    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const userData = await fetchUserRoleAndData(firebaseUser);
        // If soft-deleted, userData will be { isDeleted: true } and user was signed out
        if (userData?.isDeleted) {
          setUser(null);
        } else {
          setUser(userData);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // The onAuthStateChanged listener will handle state update, 
      // but we might want to wait for that or fetch valid user data to return here.
      const userData = await fetchUserRoleAndData(userCredential.user);

      // Check if user was soft-deleted
      if (userData?.isDeleted) {
        return { success: false, error: 'Your account has been deactivated. Please contact your administrator.' };
      }

      if (userData) {
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'User data not found.' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      toast.dismiss(); // Clear any pending toasts before signing out
      await signOut(auth);
      // State clear handled by onAuthStateChanged
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      const userData = await fetchUserRoleAndData(auth.currentUser);
      setUser(userData);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
