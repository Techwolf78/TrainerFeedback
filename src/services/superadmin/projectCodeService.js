import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  serverTimestamp,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { getAcademicConfig, saveAcademicConfig } from './academicService';

const COLLECTION_NAME = 'project_codes';

/**
 * Parse a raw project code string into structured data.
 * Format: CollegeCode/Course/Year/Type/AcademicYear
 * Example: ICCS/MSC/1st/TP/25-27
 * 
 * @param {string} rawCode 
 * @returns {Object} Parsed fields + status
 */
export const parseProjectCode = (rawCode) => {
  if (!rawCode) return { status: 'invalid', error: 'Empty code' };

  const parts = rawCode.split('/').map(p => p.trim());
  
  // Basic validation: needs at least college and academic year (min 2 parts)
  if (parts.length < 2) {
    return { 
      rawCode,
      status: 'invalid', 
      error: 'Too few segments',
      parsed: null
    };
  }

  // Best-effort mapping based on position
  // 0: College Code
  // 1: Course
  // 2: Year
  // 3: Type (Ignored/Stored but not critical)
  // 4: Academic Year (Last non-empty usually, or fixed position)

  const collegeCode = parts[0];
  const academicYear = parts[parts.length - 1]; // Last part is usually year
  
  // Middle parts
  let course = parts.length > 1 ? parts[1] : '';
  let year = parts.length > 2 ? parts[2] : '';
  
  // [MODIFIED] Do NOT hardcode "Engg" -> "B.E." here.
  // Leave it as "Engg" (or whatever) to be resolved later against college config.
  // if (course.toLowerCase() === 'engg') {
  //   course = 'B.E.';
  // }

  // Extract numeric year
  const yearMatch = year.match(/\d+/);
  if (yearMatch) {
    year = yearMatch[0];
  }
  const type = parts.length > 3 ? parts[3] : '';

  return {
    rawCode,
    status: 'parsed',
    collegeCode,
    course, // Returns "Engg" if that's what is in the string
    year,
    type,
    academicYear
  };
};

/**
 * Match a parsed code against available colleges.
 * @param {Object} parsedData 
 * @param {Array} colleges 
 */
export const matchCollege = (parsedData, colleges) => {
  if (!parsedData || parsedData.status === 'invalid') return { ...parsedData, matchStatus: 'unmatched' };

  const matchedCollege = colleges.find(c => 
    c.code?.toLowerCase() === parsedData.collegeCode?.toLowerCase() || 
    c.name?.toLowerCase() === parsedData.collegeCode?.toLowerCase() // Fallback to name check
  );

  return {
    ...parsedData,
    collegeId: matchedCollege ? matchedCollege.id : null,
    collegeName: matchedCollege ? matchedCollege.name : null,
    matchStatus: matchedCollege ? 'matched' : 'unmatched'
  };
};

/**
 * Helper: Resolve "Engg" to "B.Tech" or "B.E." based on college config.
 */
const resolveCourseName = async (collegeId, rawCourse) => {
  if (!collegeId || !rawCourse) return rawCourse;
  
  // Only try to resolve if it's "Engg" (case-insensitive)
  if (rawCourse.toLowerCase() !== 'engg') return rawCourse;

  try {
    const config = await getAcademicConfig(collegeId);
    if (!config || !config.courses) return 'B.E.'; // Default to B.E. if no config

    const courses = Object.keys(config.courses);
    const hasBTech = courses.some(c => c.toLowerCase() === 'b.tech' || c.toLowerCase() === 'b. tech');
    const hasBE = courses.some(c => c.toLowerCase() === 'b.e.' || c.toLowerCase() === 'b.e');

    // Prefer B.Tech if available
    if (hasBTech) return 'B.Tech';
    if (hasBE) return 'B.E.';
    
    return 'B.E.'; // Default fallback
  } catch (err) {
    console.error(`Error resolving course for college ${collegeId}:`, err);
    return 'B.E.';
  }
};

/**
 * Helper: Resolve Year string (e.g. "4th", "Final") to config key (e.g. "4").
 * NEW Structure: courses.{course}.years.{year}
 */
const resolveYear = async (collegeId, courseName, rawYear) => {
  if (!collegeId || !courseName || !rawYear) return rawYear;
  
  try {
    const config = await getAcademicConfig(collegeId);
    
    // Safety check for path existence
    if (!config || !config.courses || !config.courses[courseName]) {
        return rawYear.replace(/\D/g, ''); // Fallback
    }

    const courseData = config.courses[courseName];
    
    // [NEW] Structure check: Years are direct children of course
    if (!courseData.years) {
         // Fallback logic if structure is unexpected or empty
         return rawYear.replace(/\D/g, '');
    }

    // Collect all valid year keys from the years object
    const validYears = new Set(Object.keys(courseData.years));

    // 1. Try exact match
    if (validYears.has(rawYear)) return rawYear;

    // 2. Try numeric extraction
    const numeric = rawYear.match(/\d+/)?.[0];
    if (numeric && validYears.has(numeric)) return numeric;

    // 3. Try word mappings
    const lower = rawYear.toLowerCase();
    const map = {
      'first': '1', '1st': '1', 'i': '1',
      'second': '2', '2nd': '2', 'ii': '2',
      'third': '3', '3rd': '3', 'iii': '3',
      'fourth': '4', '4th': '4', 'iv': '4', 'final': '4'
    };
    
    // Check known mappings against valid years
    // Sort keys by length descending to match 'iii' before 'i'
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
       // Use word boundary check
       const regex = new RegExp(`\\b${key}\\b`, 'i');
       if (regex.test(rawYear) && validYears.has(map[key])) {
         return map[key];
       }
    }

    // Default: return numeric extraction if available, else raw
    return numeric || rawYear;

  } catch (err) {
    console.error(`Error resolving year for college ${collegeId}:`, err);
    return rawYear.replace(/\D/g, '');
  }
};

/**
 * Bulk add project codes.
 * - Parses and matches each code.
 * - Supports object input with explicit metadata (S.No, Name, etc.).
 * - [NEW] Resolves "Engg" to correct course name.
 * - [NEW] Resolves Year to config key.
 * - Checks for duplicates in DB (by rawCode).
 * - Saves to Firestore in batches.
 * 
 * @param {string[]|Object[]} inputCodes - Array of raw code strings OR objects
 * @param {Array} colleges - List of existing colleges for matching
 */
export const addProjectCodes = async (inputCodes, colleges) => {
  try {
    // 1. Process all codes locally first
    const processed = [];
    const uniqueInputs = [];
    const seenCodes = new Set();

    // Filter duplicates within the input itself
    for (const item of inputCodes) {
        let code;
        if (typeof item === 'string') {
            code = item;
        } else if (typeof item === 'object' && item !== null) {
            // Handle specific JSON import format or generic object
            code = item["Project Code"] || item.code || item.rawCode;
        }

        if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            uniqueInputs.push(item);
        }
    }

    for (const input of uniqueInputs) {
      let parsed;
      let rawMetadata = {};

      if (typeof input === 'string') {
          parsed = parseProjectCode(input);
      } else {
          // It's an object, extract metadata if available
          // Format: { "S.No": 1, "Name": "...", "College Code": "...", "Course": "...", "Year": "...", "Training Type": "...", "Passing Year": "...", "Project Code": "..." }
          const rawCode = input["Project Code"] || input.code;
          
          // If we have the specific JSON export format
          if (input["Project Code"]) {
             rawMetadata = {
                 serialNumber: input["S.No"],
                 collegeName: input["Name"], // Fallback name
                 collegeCode: input["College Code"],
                 course: input["Course"],
                 year: input["Year"],
                 type: input["Training Type"],
                 academicYear: input["Passing Year"]
             };
             
             // Construct a 'parsed' object directly from metadata
             parsed = {
                 rawCode,
                 status: 'parsed',
                 collegeCode: rawMetadata.collegeCode,
                 course: rawMetadata.course,
                 year: rawMetadata.year,
                 type: rawMetadata.type,
                 academicYear: rawMetadata.academicYear
             };
          } else {
              // Fallback to parsing the string if it's a minimal object
              parsed = parseProjectCode(rawCode);
          }
      }

      const matched = matchCollege(parsed, colleges);
      
      // Merge matched data with raw metadata (raw metadata takes precedence for things like serialNumber)
      const finalItem = {
          ...matched,
          ...rawMetadata,
          // If matched found a college link, use it. 
          // If NOT matched, we still want to keep the 'collegeName' from the JSON as a text field.
          collegeName: matched.collegeName || rawMetadata.collegeName || '',
          collegeCode: matched.collegeCode || rawMetadata.collegeCode || '',
          
          // Ensure critical fields are set
          course: matched.course || rawMetadata.course || '',
          year: matched.year || rawMetadata.year || '',
          academicYear: matched.academicYear || rawMetadata.academicYear || '',
      };

      // Resolve Course & Year if matched AND we are using standard "Engg" terms
      // We do this even for imported objects to ensure "Engg" -> "B.E." consistency
      if (finalItem.matchStatus === 'matched' && finalItem.collegeId) {
        finalItem.course = await resolveCourseName(finalItem.collegeId, finalItem.course);
        finalItem.year = await resolveYear(finalItem.collegeId, finalItem.course, finalItem.year);
      }
      
      processed.push(finalItem);
    }

    // 2. Check for existing codes in DB to avoid duplicates
    const existingSnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const existingCodes = new Set(existingSnapshot.docs.map(d => d.data().code));

    const newDocs = processed.filter(p => !existingCodes.has(p.rawCode));

    if (newDocs.length === 0) return { added: 0, skipped: processed.length };

    // 3. Batch write (max 500 ops per batch)
    const batch = writeBatch(db);
    let count = 0;

    newDocs.forEach(item => {
      const docRef = doc(collection(db, COLLECTION_NAME));
      batch.set(docRef, {
        code: item.rawCode, // Main identifier
        serialNumber: item.serialNumber || null, // [NEW] Store S.No

        collegeCode: item.collegeCode || '',
        collegeId: item.collegeId || null,
        collegeName: item.collegeName || '', // Stores text name even if unmatched
        
        course: item.course || '',
        year: item.year || '',
        type: item.type || '',
        academicYear: item.academicYear || '',
        
        parseStatus: item.status,
        matchStatus: item.matchStatus, // 'matched' or 'unmatched'
        
        createdAt: serverTimestamp()
      });
      count++;
    });

    await batch.commit();

    // 4. Auto-update Academic Config with new Courses/Years
    // Collect unique college -> course -> year mappings from the processed items
    const collegeUpdates = {}; // { collegeId: { courseName: Set(years) } }

    processed.forEach(item => {
        if (item.matchStatus === 'matched' && item.collegeId && item.course && item.year) {
            if (!collegeUpdates[item.collegeId]) {
                collegeUpdates[item.collegeId] = {};
            }
            if (!collegeUpdates[item.collegeId][item.course]) {
                collegeUpdates[item.collegeId][item.course] = new Set();
            }
            collegeUpdates[item.collegeId][item.course].add(item.year);
        }
    });

    // Process updates for each college
    for (const [collegeId, courses] of Object.entries(collegeUpdates)) {
        await autoUpdateAcademicConfig(collegeId, courses);
    }

    return { added: count, skipped: processed.length - count }; // Return result
  } catch (error) {
    console.error('Error adding project codes:', error);
    throw error;
  }
};

/**
 * Helper: Safely merge new courses and years into existing academic config.
 * - Creates Course if missing.
 * - Creates Year if missing (with empty departments).
 * - DOES NOT overwrite existing structure or delete anything.
 * 
 * @param {string} collegeId 
 * @param {Object} newCourses - { courseName: Set(years) }
 */
const autoUpdateAcademicConfig = async (collegeId, newCourses) => {
    try {
        const currentConfig = await getAcademicConfig(collegeId) || { courses: {} };
        let updated = false;

        // Ensure courses object exists
        if (!currentConfig.courses) currentConfig.courses = {};

        for (const [courseName, yearsSet] of Object.entries(newCourses)) {
            // 1. Create Course if missing
            if (!currentConfig.courses[courseName]) {
                currentConfig.courses[courseName] = { years: {} };
                updated = true;
            }

            // Ensure years object exists for the course
            if (!currentConfig.courses[courseName].years) {
                 currentConfig.courses[courseName].years = {};
                 updated = true;
            }

            // 2. Create Years if missing
            for (const year of yearsSet) {
                if (!currentConfig.courses[courseName].years[year]) {
                    // Initialize with empty departments to be valid
                    currentConfig.courses[courseName].years[year] = { departments: {} };
                    updated = true;
                }
            }
        }

        if (updated) {
            console.log(`Auto-updating academic config for college ${collegeId}`);
            await saveAcademicConfig(collegeId, currentConfig);
        }
    } catch (err) {
        console.error(`Failed to auto-update academic config for ${collegeId}:`, err);
        // Don't throw, as this is a secondary operation. 
        // We don't want to fail the import if config update fails.
    }
};

/**
 * Get all project codes
 */
export const getAllProjectCodes = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting project codes:', error);
    throw error;
  }
};

/**
 * Delete a project code
 */
export const deleteProjectCode = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (error) {
    console.error('Error deleting project code:', error);
    throw error;
  }
};

/**
 * Rerun matching for all unmatched project codes against current colleges.
 * Useful when new colleges are added.
 */
export const rerunCollegeMatching = async (colleges) => {
  try {
    // 1. Get ALL codes (removed 'unmatched' filter to support full re-sync)
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 0;

    // Firestore batch limit is 500. Processing in chunks would be safer for production.
    // For now, using single batch as per existing pattern.
    const batch = writeBatch(db); 
    let updatedCount = 0;
    const collegeUpdates = {}; // { collegeId: { courseName: Set(years) } }

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      // Try matching again
      const parsed = {
        collegeCode: data.collegeCode,
        status: data.parseStatus,
        course: data.course || ''
      };
      
      const matched = matchCollege(parsed, colleges);

      if (matched.matchStatus === 'matched') {
         // [NEW] Resolve Course Name
         const resolvedCourse = await resolveCourseName(matched.collegeId, data.course);
         const resolvedYear = await resolveYear(matched.collegeId, resolvedCourse, data.year);
         
         // Collect for auto-config (only if matched)
         if (matched.collegeId && resolvedCourse && resolvedYear) {
             if (!collegeUpdates[matched.collegeId]) {
                 collegeUpdates[matched.collegeId] = {};
             }
             if (!collegeUpdates[matched.collegeId][resolvedCourse]) {
                 collegeUpdates[matched.collegeId][resolvedCourse] = new Set();
             }
             collegeUpdates[matched.collegeId][resolvedCourse].add(resolvedYear);
         }

         batch.update(docSnap.ref, {
            collegeId: matched.collegeId,
            collegeName: matched.collegeName,
            matchStatus: 'matched',
            course: resolvedCourse,
            year: resolvedYear,
            updatedAt: serverTimestamp()
         });
         updatedCount++;
      } else {
         // If unmatched, reset fields
         if (data.matchStatus === 'matched') {
             batch.update(docSnap.ref, {
                 collegeId: null,
                 collegeName: data.collegeName, // Keep original name from file
                 matchStatus: 'unmatched',
                 updatedAt: serverTimestamp()
             });
             updatedCount++;
         }
      }
    }

    if (updatedCount > 0) {
        await batch.commit();
    }

    // Auto-create config ONLY if empty
    for (const [collegeId, courses] of Object.entries(collegeUpdates)) {
        const currentConfig = await getAcademicConfig(collegeId);
        // Check if config is essentially empty (no courses defined)
        const isEmpty = !currentConfig || !currentConfig.courses || Object.keys(currentConfig.courses).length === 0;
        
        if (isEmpty) {
            console.log(`Academic Config is empty for ${collegeId}. Auto-creating from project codes...`);
            await autoUpdateAcademicConfig(collegeId, courses);
        } else {
            console.log(`Academic Config exists for ${collegeId}. Skipping auto-creation.`);
        }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error rerunning college matching:', error); // Note: original error logged different message? "Error rerunning matching:" vs "Error rerunning college matching:"
    throw error;
  }
};

/**
 * Create a single project code.
 * Stores the document with the same field structure used by the bulk import,
 * and auto-updates the academic config so the course/year appears in the
 * configuration tab.
 */
export const createProjectCode = async (data) => {
  try {
    // Check for duplicate code
    const q = query(collection(db, COLLECTION_NAME), where('code', '==', data.code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error(`Project code "${data.code}" already exists.`);
    }

    // Build the document with the canonical field structure
    const docData = {
      code: data.code,                     // Main identifier (raw project code string)
      collegeId: data.collegeId || null,
      collegeName: data.collegeName || '',
      collegeCode: data.collegeCode || '',
      course: data.course || '',
      year: data.year || '',
      type: data.type || '',
      academicYear: data.academicYear || '',
      parseStatus: 'parsed',               // Manual entry is always valid
      matchStatus: data.collegeId ? 'matched' : 'unmatched',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    // Auto-update academic config so this course/year shows in the config tab
    if (docData.collegeId && docData.course && docData.year) {
      const yearNum = docData.year.replace(/\D/g, '') || docData.year;
      await autoUpdateAcademicConfig(docData.collegeId, {
        [docData.course]: new Set([yearNum])
      });
    }

    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error('Error creating project code:', error);
    throw error;
  }
};

/**
 * Update an existing project code.
 * Maintains the canonical field structure and auto-updates academic config.
 */
export const updateProjectCode = async (id, data) => {
  try {
    const docData = {
      code: data.code,
      collegeId: data.collegeId || null,
      collegeName: data.collegeName || '',
      collegeCode: data.collegeCode || '',
      course: data.course || '',
      year: data.year || '',
      type: data.type || '',
      academicYear: data.academicYear || '',
      matchStatus: data.collegeId ? 'matched' : 'unmatched',
      updatedAt: serverTimestamp()
    };

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, docData);

    // Auto-update academic config for the new course/year
    if (docData.collegeId && docData.course && docData.year) {
      const yearNum = docData.year.replace(/\D/g, '') || docData.year;
      await autoUpdateAcademicConfig(docData.collegeId, {
        [docData.course]: new Set([yearNum])
      });
    }

    return { id, ...docData };
  } catch (error) {
    console.error('Error updating project code:', error);
    throw error;
  }
};
