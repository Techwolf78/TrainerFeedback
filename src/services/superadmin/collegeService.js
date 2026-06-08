import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const COLLECTION_NAME = 'colleges';
const COLLEGE_CODE_REGEX = /^[A-Z0-9]{2,12}$/;

export const normalizeCollegeCode = (code = '') => code.trim().toUpperCase();

export const getCollegeCodeValidationMessage = (code) => {
  const normalizedCode = normalizeCollegeCode(code);

  if (!normalizedCode) {
    return 'College code is required.';
  }

  if (normalizedCode.includes('/')) {
    return 'Enter only the short college code, not a full project code. Example: GIT, ICEM, SPIT.';
  }

  if (!COLLEGE_CODE_REGEX.test(normalizedCode)) {
    return 'College code must be 2-12 letters/numbers only. Do not use spaces, slashes, hyphens, or project-code details.';
  }

  return '';
};

const assertValidCollegeCode = (code) => {
  const message = getCollegeCodeValidationMessage(code);
  if (message) throw new Error(message);
  return normalizeCollegeCode(code);
};

/**
 * Subscribe to real-time college updates
 * @param {Function} callback - Function called with updated colleges array
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToColleges = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const colleges = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(colleges);
  }, (error) => {
    console.error("Error subscribing to colleges:", error);
  });
};

// Add a new college
export const addCollege = async ({ name, code, logoUrl = '' }) => {
  try {
    const normalizedCode = assertValidCollegeCode(code);

    // Check for duplicate code (only among non-deleted colleges)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('code', '==', normalizedCode),
      where('isDeleted', '==', false)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error(`College with code ${normalizedCode} already exists.`);
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name,
      code: normalizedCode,
      logoUrl,
      isDeleted: false,
      createdAt: serverTimestamp()
    });

    return { id: docRef.id, name, code: normalizedCode, logoUrl };
  } catch (error) {
    console.error('Error adding college:', error);
    throw error;
  }
};

// Update an existing college
export const updateCollege = async (id, updates) => {
  try {
    const sanitizedUpdates = { ...updates };

    if (sanitizedUpdates.code !== undefined) {
      sanitizedUpdates.code = assertValidCollegeCode(sanitizedUpdates.code);

      const duplicateQ = query(
        collection(db, COLLECTION_NAME),
        where('code', '==', sanitizedUpdates.code),
        where('isDeleted', '==', false)
      );
      const duplicateSnapshot = await getDocs(duplicateQ);
      const hasDuplicate = duplicateSnapshot.docs.some(
        (collegeDoc) => collegeDoc.id !== id
      );

      if (hasDuplicate) {
        throw new Error(`College with code ${sanitizedUpdates.code} already exists.`);
      }
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp()
    });
    return { id, ...sanitizedUpdates };
  } catch (error) {
    console.error('Error updating college:', error);
    throw error;
  }
};

// Soft delete a college (sets isDeleted flag instead of removing the document)
export const deleteCollege = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error soft-deleting college:', error);
    throw error;
  }
};

// Restore a soft-deleted college
export const restoreCollege = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isDeleted: false,
      restoredAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error restoring college:', error);
    throw error;
  }
};

// Get all colleges (including archived ones)
export const getAllColleges = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('name', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting colleges:', error);
    throw error;
  }
};

// Get college by ID (returns null for soft-deleted colleges)
export const getCollegeById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Exclude soft-deleted colleges
      if (data.isDeleted === true) return null;
      return { id: docSnap.id, ...data };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting college:', error);
    throw error;
  }
};

// Bulk add colleges
export const bulkAddColleges = async (collegesArray) => {
  try {
    if (!Array.isArray(collegesArray) || collegesArray.length === 0) {
      throw new Error('Please provide a non-empty array of colleges.');
    }

    // Fetch all existing codes to check for duplicates (only among non-deleted colleges)
    const existingQ = query(
      collection(db, COLLECTION_NAME),
      where('isDeleted', '==', false)
    );
    const existingSnapshot = await getDocs(existingQ);
    const existingCodes = new Set(
      existingSnapshot.docs.map(doc => doc.data().code?.toUpperCase())
    );

    let added = 0;
    let skipped = 0;
    const errors = [];

    for (const item of collegesArray) {
      const name = (item.Name || item.name || '').trim();
      const code = normalizeCollegeCode(item['College Code'] || item.code || '');
      const logoUrl = (item.logoUrl || item.LogoUrl || '').trim();

      if (!name || !code) {
        skipped++;
        errors.push(`Skipped entry with missing name or code: ${JSON.stringify(item)}`);
        continue;
      }

      const codeValidationMessage = getCollegeCodeValidationMessage(code);
      if (codeValidationMessage) {
        skipped++;
        errors.push(`Skipped invalid college code "${code}": ${codeValidationMessage}`);
        continue;
      }

      if (existingCodes.has(code)) {
        skipped++;
        errors.push(`Skipped duplicate code: ${code}`);
        continue;
      }

      try {
        await addDoc(collection(db, COLLECTION_NAME), {
          name,
          code,
          logoUrl,
          isDeleted: false,
          createdAt: serverTimestamp()
        });
        existingCodes.add(code); // prevent duplicates within the same batch
        added++;
      } catch (err) {
        errors.push(`Failed to add ${code}: ${err.message}`);
      }
    }

    return { added, skipped, errors };
  } catch (error) {
    console.error('Error bulk adding colleges:', error);
    throw error;
  }
};
