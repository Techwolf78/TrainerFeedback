import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { addTrainer, getAllTrainers, updateTrainerIdCounter } from './trainerService';
import { createSystemUser, getAllSystemUsers } from './userService';
import { saveAcademicConfig } from './academicService';
import { seedSessionsAndResponses } from './seedSessions';

// Using mock data file used by local mock mode
import initialData from '../../data/storage.json';

/**
 * Seed Firestore with initial demo data.
 *
 * This is intended to be run on a fresh Firebase project to create:
 * - Colleges
 * - Academic configurations
 * - Trainers (Auth + Firestore)
 * - System users (SuperAdmin + College Admins)
 * - Sessions + Responses (optional)
 *
 * This is NOT idempotent across runs (it will skip existing docs/users when possible),
 * but it may create additional sessions/responses each time.
 */
export const seedFirestoreData = async ({ createSessions = true, sessionsPerCollege = 2, minResponses = 10, maxResponses = 20 } = {}) => {
  const results = {
    colleges: { added: 0, skipped: 0 },
    academicConfigs: { added: 0, skipped: 0 },
    trainers: { added: 0, skipped: 0, errors: [] },
    systemUsers: { added: 0, skipped: 0, errors: [] },
    sessions: { created: 0, responses: 0, errors: [] }
  };

  // 1) Seed Colleges
  for (const college of initialData.colleges || []) {
    try {
      const collegeRef = doc(db, 'colleges', college.id);
      const snap = await getDoc(collegeRef);
      if (snap.exists()) {
        results.colleges.skipped += 1;
        continue;
      }

      await setDoc(collegeRef, {
        name: college.name,
        code: college.code,
        logoUrl: college.logo || '',
        address: college.address || '',
        phone: college.phone || '',
        email: college.email || '',
        isDeleted: false,
        createdAt: serverTimestamp()
      });
      results.colleges.added += 1;
    } catch (err) {
      // ignore; we'll keep going
      console.error('Error seeding college', college, err);
    }
  }

  // 2) Seed Academic Configs (convert legacy structure to current structure)
  const convertLegacyAcademicConfig = (legacy) => {
    if (!legacy || !Array.isArray(legacy.courses)) return { courses: {} };

    const batches = Array.isArray(legacy.batches) && legacy.batches.length > 0
      ? legacy.batches
      : ['Batch A', 'Batch B'];

    const years = ['1', '2'];

    const courses = {};
    for (const course of legacy.courses) {
      const specializations = (legacy.specializations || {})[course] || [];
      const departments = (specializations.length > 0 ? specializations : ['General']).reduce(
        (acc, spec) => ({
          ...acc,
          [spec]: { batches }
        }),
        {}
      );

      const yearMap = {};
      for (const year of years) {
        yearMap[year] = { departments };
      }

      courses[course] = { years: yearMap };
    }

    return { courses };
  };

  for (const config of initialData.academicConfigs || []) {
    try {
      const existingRef = doc(db, 'academic_configs', config.collegeId);
      const existing = await getDoc(existingRef);
      if (existing.exists()) {
        results.academicConfigs.skipped += 1;
        continue;
      }

      const academicConfig = convertLegacyAcademicConfig(config);
      await saveAcademicConfig(config.collegeId, academicConfig);
      results.academicConfigs.added += 1;
    } catch (err) {
      console.error('Error seeding academic config', config, err);
    }
  }

  // 3) Seed Trainers
  const existingTrainers = await getAllTrainers(200);
  const existingTrainerIds = new Set(existingTrainers.trainers.map(t => t.trainer_id));
  const existingTrainerEmails = new Set(existingTrainers.trainers.map(t => t.email?.toLowerCase()));

  // Determine starting counter for trainer IDs
  const existingNumbers = Array.from(existingTrainerIds)
    .map(id => {
      const match = id.match(/^GA-T(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(Boolean);
  const nextTrainerNumber = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
  let trainerCounter = nextTrainerNumber;

  for (const user of initialData.users || []) {
    if (user.role !== 'trainer') continue;

    const email = (user.email || '').toLowerCase();
    if (existingTrainerEmails.has(email)) {
      results.trainers.skipped += 1;
      continue;
    }

    const trainerId = `GA-T${String(trainerCounter).padStart(3, '0')}`;
    trainerCounter += 1;

    try {
      await addTrainer(
        {
          trainer_id: trainerId,
          name: user.name,
          domain: user.specialization || 'General',
          specialisation: user.specialization || 'General',
          topics: [],
          email: user.email,
          password: user.password || 'password123'
        },
        { skipCounterUpdate: true }
      );
      results.trainers.added += 1;
    } catch (err) {
      results.trainers.errors.push({ email: user.email, error: err.message });
    }
  }

  // Update trainer counter at end (if any were added)
  if (trainerCounter > nextTrainerNumber) {
    await updateTrainerIdCounter(trainerCounter - 1);
  }

  // 4) Seed System Users (SuperAdmin + College Admins)
  const existingUsers = await getAllSystemUsers();
  const existingUserEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()));

  for (const user of initialData.users || []) {
    if (!['superAdmin', 'collegeAdmin'].includes(user.role)) continue;

    const email = (user.email || '').toLowerCase();
    if (existingUserEmails.has(email)) {
      results.systemUsers.skipped += 1;
      continue;
    }

    try {
      await createSystemUser(
        {
          name: user.name,
          email: user.email,
          role: user.role,
          collegeId: user.collegeId || null
        },
        user.password || 'password123'
      );
      results.systemUsers.added += 1;
    } catch (err) {
      results.systemUsers.errors.push({ email: user.email, error: err.message });
    }
  }

  // 5) Optionally seed Sessions + Responses
  if (createSessions) {
    try {
      const sessionResults = await seedSessionsAndResponses({
        sessionsPerCollege,
        minResponses,
        maxResponses
      });

      results.sessions.created = sessionResults.sessions.length;
      results.sessions.responses = sessionResults.totalResponses;
      results.sessions.errors = sessionResults.errors;
    } catch (err) {
      results.sessions.errors.push({ error: err.message });
    }
  }

  return results;
};
