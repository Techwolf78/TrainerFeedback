import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';

const COLLECTION_NAME = 'feedback_templates';

export const createTemplate = async (templateData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...templateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...templateData };
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
};

export const updateTemplate = async (id, data) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { id, ...data };
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

export const deleteTemplate = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

export const getAllTemplates = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting templates:', error);
    throw error;
  }
};

export const getTemplateById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting template:', error);
    throw error;
  }
};

// Seed function to create a default template if none exist
export const seedDefaultTemplate = async () => {
  const templates = await getAllTemplates();
  if (templates.length === 0) {
    const defaultTemplate = {
      title: "Standard Session Feedback",
      description: "Complete feedback for the training session.",
      isDefault: true,
      sections: [
        {
          id: "s1",
          title: "Session Feedback",
          questions: [
            { id: "q1", text: "How would you rate the trainer's knowledge of the subject?", type: "rating", required: true },
            { id: "q2", text: "Was the trainer able to explain complex concepts clearly?", type: "rating", required: true },
            { id: "q3", text: "Did the trainer use practical examples and demonstrations?", type: "rating", required: true },
            { id: "q4", text: "How responsive was the trainer to doubts and queries?", type: "rating", required: true },
            { id: "q5", text: "How would you rate the overall content quality and relevance?", type: "rating", required: true },
            { id: "q6", text: "Was the session pace appropriate?", type: "mcq", options: ["Too Fast", "Just Right", "Too Slow"], required: true },
            { id: "q7", text: "How would you rate the audio/video quality of the session?", type: "rating", required: true },
            { id: "q8", text: "Overall, how satisfied are you with this session?", type: "rating", required: true },
            { id: "q9", text: "What were the key topics covered in today's session? (Separated by commas)", type: "topicslearned", required: false },
            { id: "q10", text: "What topics would you like to see in future sessions?", type: "futureSession", required: false },
            { id: "q11", text: "Any additional comments or suggestions for improvement?", type: "text", required: false }
          ]
        }
      ]
    };
    await createTemplate(defaultTemplate);
    return defaultTemplate;
  }
  return null;
};
