import store2 from 'store2';
import { parse, stringify } from 'yaml';

type EntryId = number;

interface IdentifiableEntry {
  id: EntryId;
}

interface SerializedWatchedEntry extends IdentifiableEntry {
  title?: string;
  year?: number;
  watchedOn: string;
}

interface WatchedEntry {
  title?: string;
  year?: number;
  watchedOn: string;
}

type WatchedStore = Record<EntryId, WatchedEntry>;

export interface Watched extends IdentifiableEntry, WatchedEntry {}

const namespace = 'watched';

const _store = store2.namespace(namespace);

export const store = {
  getAll() {
    return _store.getAll() as WatchedStore;
  },
  get(id: EntryId) {
    const entry = _store.get(id);
    if (!entry) return;

    return { id, ...entry } as Watched;
  },
  load() {
    return Object.entries(store.getAll())
      .map(([id, watched]) => ({ id: Number(id), ...watched }))
      .sort((a, b) => new Date(b.watchedOn).getTime() - new Date(a.watchedOn).getTime());
  },
  has(id: EntryId) {
    return _store.has(id);
  },
  add({ id, ...watched }: Watched) {
    _store.add(id, watched);
  },
  remove(id: EntryId) {
    _store.remove(id);
  },
  set({ id, ...watched }: Watched) {
    _store.set(id, watched);
  },
  clear() {
    _store.clear();
  },
  exportAll() {
    return store.serialize(store.getAll());
  },
  serialize(map: WatchedStore) {
    return stringify(
      Object.entries(map).map(([id, { watchedOn }]) => ({ id: Number(id), watchedOn })),
    );
  },
  async importAll(payload: string) {
    _store.setAll(await store.deserialize(payload));
  },
  async deserialize(payload: string) {
    const entries = await store.hydrate(parse(payload));
    return Object.fromEntries(entries.map(({ id, ...watched }) => [id, watched]));
  },
  async hydrate(entries: SerializedWatchedEntry[]) {
    const watched: Watched[] = [];
    for (const entry of entries) {
      const { id, watchedOn } = entry;
      let { title, year } = entry;
      if (!title || !year) {
        const res = await fetch(`/api/movie/${id}/title`).then((res) => res.json());
        title = res.title;
        year = res.year;
      }
      const watchedEntry: Watched = { id, watchedOn, title, year };
      watched.push(watchedEntry);
    }
    return watched;
  },
};
