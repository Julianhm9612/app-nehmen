import { DB, Cursor } from 'idb';

import { Entry } from '../models/entry.model';
import { caloryEntriesStore, caloryEntriesByDayIndex } from './index-db';
import { dayString } from '../utils/date.utils';
import { forEach } from './utils';
import { AutoSuggestion } from '../models/auto-suggestion.model';

export async function upsertEntry(dbPromise: Promise<DB>, entry: Entry) {
    const db = await dbPromise;
    const tx = db.transaction(caloryEntriesStore, 'readwrite');
    tx.objectStore<Entry>(caloryEntriesStore).put(entry);
    return tx.complete;
}

export async function removeEntry(dbPromise: Promise<DB>, key: string) {
    const db = await dbPromise;
    const tx = db.transaction(caloryEntriesStore, 'readwrite');
    tx.objectStore<Entry>(caloryEntriesStore).delete(key);
    return tx.complete;
}

export async function getAllEntries(dbPromise: Promise<DB>) {
    const db = await dbPromise;
    return db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .getAll();
}

export async function getEntryByDay(dbPromise: Promise<DB>, date: Date) {
    const dateStr = dayString(date);
    const db = await dbPromise;
    return db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .index(caloryEntriesByDayIndex)
        .getAll(IDBKeyRange.only(dateStr));
}

export async function getAutoSuggestionEntries(
    dbPromise: Promise<DB>,
    search: string
) {
    function groupKey(e: Entry): string {
        return `${e.description}#${e.calories}`;
    }
    const searchLower = search.toLowerCase();

    const result = new Map<string, AutoSuggestion>();

    const db = await dbPromise;

    const allEntries = await db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .openCursor();

    await forEach<Entry>(allEntries, entry => {
        if ((entry.description || '').toLowerCase().includes(searchLower)) {
            if (!result.has(groupKey(entry))) {
                result.set(groupKey(entry), {
                    calories: entry.calories,
                    description: entry.description,
                    exercise: entry.exercise,
                    frequency: 1
                });
            } else {
                result.get(groupKey(entry)).frequency++;
            }
        }
    });
    return Array.from(result.values());
}
