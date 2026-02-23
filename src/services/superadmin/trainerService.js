import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc, 
  getDocs, 
  query, 
  where,
  getDoc,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter
} from 'firebase/firestore';
import { createUserWithoutLoggingIn } from '../authService';
import { sendTrainerOnboardingEmail } from '../emailJsService';

const COLLECTION_NAME = 'trainers';
const COUNTER_COLLECTION = 'counters';
const TRAINER_COUNTER_DOC = 'trainers';
const TRAINER_ID_REGEX = /^GA-T\d{3}$/;

// Get the current trainer ID counter
export const getTrainerIdCounter = async () => {
    try {
        const docRef = doc(db, COUNTER_COLLECTION, TRAINER_COUNTER_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().lastId || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting trainer ID counter:', error);
        return 0;
    }
};

// Update the trainer ID counter
export const updateTrainerIdCounter = async (newValue) => {
    try {
        const docRef = doc(db, COUNTER_COLLECTION, TRAINER_COUNTER_DOC);
        await setDoc(docRef, { lastId: newValue }, { merge: true });
    } catch (error) {
        console.error('Error updating trainer ID counter:', error);
    }
};

// Add a new trainer
export const addTrainer = async ({ trainer_id, name, domain, specialisation, topics = [], email, password }) => {
  try {
    // Validate ID format
    if (!TRAINER_ID_REGEX.test(trainer_id)) {
        throw new Error(`Invalid Trainer ID format. Must be GA-TXXX (e.g., GA-T001). Received: ${trainer_id}`);
    }

    // Check for duplicate trainer_id
    const q = query(collection(db, COLLECTION_NAME), where('trainer_id', '==', trainer_id));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      throw new Error(`Trainer with ID ${trainer_id} already exists.`);
    }

    // Create Auth User first
    let uid;
    try {
        uid = await createUserWithoutLoggingIn(email, password);
    } catch (authError) {
        // If auth fails (e.g. email exists), throw immediately
        throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // Use UID as Document ID
    await setDoc(doc(db, COLLECTION_NAME, uid), {
        uid, // redundancy but useful
        role: 'trainer',
        trainer_id,
        name,
        domain,
        specialisation,
        topics,
        email,
        createdAt: serverTimestamp()
    });
    
    // Send Onboarding Email
    await sendTrainerOnboardingEmail({
      name,
      email,
      temporary_password: password
    });

    // Return compatible object
    return { id: uid, trainer_id, name, email };
  } catch (error) {
    console.error('Error adding trainer:', error);
    throw error;
  }
};

// Update an existing trainer
export const updateTrainer = async (id, updates) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { id, ...updates };
  } catch (error) {
    console.error('Error updating trainer:', error);
    throw error;
  }
};

// Delete a trainer
export const deleteTrainer = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (error) {
    console.error('Error deleting trainer:', error);
    throw error;
  }
};

// Get all trainers (with pagination)
export const getAllTrainers = async (limitCount = 10, lastDoc = null) => {
  try {
    let q = query(collection(db, COLLECTION_NAME), limit(limitCount));
    
    if (lastDoc) {
      q = query(collection(db, COLLECTION_NAME), startAfter(lastDoc), limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    const trainers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { 
        trainers, 
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        hasMore: querySnapshot.docs.length === limitCount
    };
  } catch (error) {
    console.error('Error getting trainers:', error);
    throw error;
  }
};

// Get trainer by ID (Firestore Document ID)
export const getTrainerById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting trainer:', error);
    throw error;
  }
};

// Batch add trainers with skip-if-exists and client-side ID generation
export const addTrainersBatch = async (trainers) => {
    const results = {
        success: [],
        errors: [],
        skipped: []
    };
    
    // 1. Fetch initial counter
    let currentCounter = await getTrainerIdCounter();
    const initialCounter = currentCounter;

    // 2. Fetch existing trainer IDs to check for duplicates efficiently
    const existingIds = new Set();
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.trainer_id) existingIds.add(data.trainer_id);
    });
    
    for (const trainer of trainers) {
        try {
            // Check if trainer_id already exists
            if (trainer.trainer_id && existingIds.has(trainer.trainer_id)) {
                results.skipped.push({
                    trainer_id: trainer.trainer_id,
                    name: trainer.name,
                    reason: 'ID already exists'
                });
                continue;
            }

            // Assign ID if not present or needs to follow sequence (based on user request)
            // If they didn't provide an ID, we generate GA-TXXX
            let trainerData = { ...trainer };
            if (!trainerData.trainer_id) {
                currentCounter++;
                trainerData.trainer_id = `GA-T${currentCounter.toString().padStart(3, '0')}`;
                trainerData.password = trainerData.trainer_id; // Set ID as password if generated
            }

            const added = await addTrainer(trainerData);
            results.success.push(added);
            existingIds.add(trainerData.trainer_id); // Add to local set to avoid duplicates within batch
        } catch (error) {
            results.errors.push({
                trainer_id: trainer.trainer_id || 'Generating...',
                name: trainer.name,
                error: error.message
            });
        }
    }
    
    // 3. Update counter if it changed
    if (currentCounter > initialCounter) {
        await updateTrainerIdCounter(currentCounter);
    }
    
    return results;
};
