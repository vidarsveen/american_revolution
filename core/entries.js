/* ============================================================
   entries.js — one model for everything a reader can look up.

   WHY THIS EXISTS

   The fourth tab was called "Personer" and it was compiled into js/main.js:
   a hardcoded VIEWS row, and a viewHasContent() that asked
   `data.people.length > 0`. That is fine for a war and wrong for everything
   else. A course about Italian wine has no people in it at all, so it got no
   browsable anything — its glossary, its grapes and its regions were
   reachable ONLY by tapping a marked word as it went past, and there was
   nowhere to go afterwards to look one up.

   Meanwhile people.json, terms.json, topics.json and place-notes.json were
   four pools with four slightly different shapes, and a wine `grape` had to
   pretend to be a `term` to exist at all. That is fitting one subject into
   another subject's data model, which is the thing this framework is
   supposed to have stopped doing.

   SO: an ENTRY is a thing a reader can look up. It has an id, a kind, a
   name, a hook and a body, and optionally a portrait, a picture, a side, a
   date and a fact. What differs between a person and a grape is
   PRESENTATION, and presentation is declared by the pack:

       "entries": {
         "person": { "label": {...}, "browse": true, "portrait": true },
         "term":   { "label": {...}, "browse": true },
         "grape":  { "label": {...}, "browse": true, "media": true }
       }

   MIGRATION, NOT REWRITE

   The four pool files keep their names and their contents. This module reads
   them, stamps a `kind` and normalises three field spellings — a person has
   `name`, a term has `term`, a topic has `title`; a person has `hook`, a term
   has `short`. Nothing on disk had to move, and `term.mark` already took
   `kind` + `id`, which is the sign the model was nearly right and only the
   browse layer was hardcoded.

   A pack that declares no `entries` gets defaults derived from the pools it
   actually has, so every existing pack works untouched.
   ============================================================ */

/* Where each shipped pool lands, and which field holds its name and hook.
   `from` is the pool key in pack.json's `pools`, falling back to the
   conventional filename. */
const BUILT_IN = {
  person: { from: 'people', name: ['name'], hook: ['hook'], portrait: true },
  term:   { from: 'terms', name: ['term', 'name'], hook: ['short', 'hook'] },
  topic:  { from: 'topics', name: ['title', 'name'], hook: ['hook'] },
  place:  { from: 'placeNotes', name: ['name'], hook: ['hook'] },
};

const DEFAULT_LABEL = {
  person: { no: 'Personer', en: 'People' },
  term:   { no: 'Ordbok', en: 'Glossary' },
  topic:  { no: 'Tema', en: 'Topics' },
  place:  { no: 'Steder', en: 'Places' },
};

const first = (obj, keys) => {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return null;
};

/**
 * One entry, in the shape everything downstream reads.
 *
 * Keeps the original object's other fields — `fact`, `sources`, `lived`,
 * `role`, `wiki`, `seeAlso` — because core/dossier.js already knows how to
 * render several of them and this is not the place to decide what it may see.
 */
function normalise(id, raw, kind, spec) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    id,
    kind,
    name: first(raw, spec.name) ?? id,
    hook: first(raw, spec.hook) ?? '',
    body: raw.body ?? '',
  };
}

/**
 * Which kinds this pack has, and what to call them.
 *
 * Declared wins. Undeclared falls back to the built-ins, so a pack written
 * before this existed behaves exactly as it did.
 */
export function kindsOf(packInfo, pools) {
  const declared = packInfo?.entries;
  if (declared && typeof declared === 'object') {
    return Object.entries(declared).map(([id, spec]) => ({
      id,
      label: spec.label || DEFAULT_LABEL[id] || { no: id, en: id },
      browse: spec.browse !== false,
      portrait: Boolean(spec.portrait ?? BUILT_IN[id]?.portrait),
      media: Boolean(spec.media),
      order: spec.order,
    }));
  }
  return Object.keys(BUILT_IN)
    .filter((id) => pools?.[id]?.length)
    .map((id) => ({
      id,
      label: DEFAULT_LABEL[id],
      browse: true,
      portrait: Boolean(BUILT_IN[id].portrait),
      media: false,
    }));
}

/**
 * Build the index from pools already loaded.
 *
 * Takes loaded data rather than fetching, on purpose: engine/script.js loads
 * every pool in ONE wave before the first cue, because an await inside a cue
 * handler is how Massachusetts ended up washed blue over the whole map. This
 * module must not add a second fetch on a different clock.
 *
 * `raw` is { person: {...} | [...], term: {...}, ... } — a list for people, a
 * keyed object for the rest, which is how they happen to be written on disk.
 */
export function buildEntries(raw = {}, packInfo = null) {
  const byKind = new Map();
  const index = new Map();

  const kindSpecs = { ...BUILT_IN };
  for (const [id, spec] of Object.entries(packInfo?.entries || {})) {
    kindSpecs[id] = {
      from: spec.from || id,
      name: spec.nameField ? [spec.nameField] : (BUILT_IN[id]?.name || ['name', 'term', 'title']),
      hook: spec.hookField ? [spec.hookField] : (BUILT_IN[id]?.hook || ['hook', 'short']),
      portrait: Boolean(spec.portrait ?? BUILT_IN[id]?.portrait),
    };
  }

  for (const [kind, spec] of Object.entries(kindSpecs)) {
    const pool = raw[kind];
    if (!pool) continue;
    const list = [];
    const items = Array.isArray(pool)
      ? pool.map((p) => [p?.id, p])
      : Object.entries(pool).filter(([k]) => !k.startsWith('//'));
    for (const [id, item] of items) {
      if (!id) continue;
      const e = normalise(id, item, kind, spec);
      if (!e) continue;
      list.push(e);
      // Keyed by kind AND id: a `place` called barolo and a `wine` called
      // barolo are different entries and both are correct.
      index.set(`${kind}:${id}`, e);
    }
    if (list.length) byKind.set(kind, list);
  }

  const pools = Object.fromEntries([...byKind].map(([k, v]) => [k, v]));
  return {
    index,
    byKind,
    kinds: kindsOf(packInfo, pools).filter((k) => byKind.has(k.id)),
    get(kind, id) { return index.get(`${kind}:${id}`) || null; },
    all() { return [...index.values()]; },
    count() { return index.size; },
  };
}

/**
 * Free-text search across every entry.
 *
 * Name and hook only, not the body: a glossary search that matches the middle
 * of a three-paragraph article returns everything and helps nobody.
 */
export function searchEntries(entries, query, lang = 'no') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const pick = (f) => (typeof f === 'string' ? f : (f?.[lang] ?? f?.no ?? f?.en ?? ''));
  return entries.all().filter((e) => (
    pick(e.name).toLowerCase().includes(q) || pick(e.hook).toLowerCase().includes(q)
  ));
}
