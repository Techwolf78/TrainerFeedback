import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

/**
 * One-time backfill utility.
 * Adds `isDeleted: false` to all existing documents in trainers, users,
 * and colleges collections that don't already have the field.
 *
 * Run this once via a button/console to ensure existing records work
 * with the new `where('isDeleted', '==', false)` queries.
 *
 * Usage (from browser console or a temp admin button):
 *   import { backfillIsDeleted } from '@/services/superadmin/backfillIsDeleted';
 *   backfillIsDeleted();
 */
export const backfillIsDeleted = async () => {
    const collectionsToBackfill = ['trainers', 'users', 'colleges'];
    const results = {};

    for (const colName of collectionsToBackfill) {
        let updated = 0;
        let skipped = 0;

        try {
            const snapshot = await getDocs(collection(db, colName));

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();

                // Only update docs that don't already have the isDeleted field
                if (data.isDeleted === undefined || data.isDeleted === null) {
                    await updateDoc(doc(db, colName, docSnap.id), { isDeleted: false });
                    updated++;
                } else {
                    skipped++;
                }
            }

            results[colName] = { total: snapshot.size, updated, skipped };
            console.log(
                `[backfill] ${colName}: ${updated} updated, ${skipped} skipped (already had isDeleted)`
            );
        } catch (error) {
            console.error(`[backfill] Error processing ${colName}:`, error);
            results[colName] = { error: error.message };
        }
    }

    console.log('[backfill] Complete:', results);
    return results;
};
