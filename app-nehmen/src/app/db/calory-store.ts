import { DB, Cursor } from 'idb';

import { Entry } from '../models/entry.model';
import {
    caloryEntriesStore,
    caloryEntriesByDayIndex,
    caloryEntriesByTimestampIndex
} from './index-db';
import { forEach, take } from './utils';
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

export async function getEntryById(dbPromise: Promise<DB>, key: string) {
    const db = await dbPromise;
    return db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .get(key);
}

export async function getEntriesByDay(dbPromise: Promise<DB>, date: string) {
    const db = await dbPromise;
    return db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .index(caloryEntriesByDayIndex)
        .getAll(IDBKeyRange.only(date));
}

export async function hasEntriesOlderThan(
    dbPromise: Promise<DB>,
    date: string
) {
    const db = await dbPromise;
    const count = await db
        .transaction(caloryEntriesStore)
        .objectStore<Entry>(caloryEntriesStore)
        .index(caloryEntriesByDayIndex)
        .count(IDBKeyRange.upperBound(date, true));
    return count > 0;
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
        .index(caloryEntriesByTimestampIndex)
        .openCursor(null, 'prev');

    await take<Entry>(allEntries, 1000, entry => {
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
