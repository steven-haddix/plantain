# Drag & Drop Itinerary Items — Design

**Status:** Approved for implementation
**Author:** Steven Haddix (with Claude)
**Date:** 2026-05-17

## Summary

Add drag-and-drop reordering to the itinerary rail. Users can drag any event card to:
- Reorder within the same day/bucket.
- Move to a different bucket within the same day.
- Move to a different day entirely.

During a drag, the day currently under the cursor visually expands into five labeled bucket clusters (Morning / Afternoon / Evening / Night / Anytime), each acting as an explicit landing zone. Other days remain in the existing compact timeline view so the rail doesn't get visually noisy. On drop, the change is persisted optimistically.

## Scope

**In scope:**
- Internal drag within the itinerary rail (reorder, change bucket, change day).
- Pointer, touch, and keyboard input via `@dnd-kit` sensors.
- Optimistic SWR cache updates with rollback on error.
- Schema migration from integer `sort_order` to fractional-indexing string keys.

**Explicitly out of scope (follow-up work):**
- Dragging from the Saved Locations rail into the itinerary.
- Dragging onto map markers / from map markers into the rail.
- Realtime broadcast of moves over socket.io. The PATCH path is the only sync mechanism for v1; SWR polling/revalidation closes the loop for other clients.

## Behavior

### Default (no drag in progress)

Identical to today: each day renders one continuous vertical timeline of cards, sorted by `bucket` then `sortOrder`. No bucket section headers visible.

### During a drag

1. The dragged card lifts into a floating `DragOverlay` (rendered via a portal so it isn't clipped by the scroll container).
2. The **active day** — the day region currently under the cursor — expands into five labeled bucket clusters. Existing events in that day regroup into their bucket; empty buckets show a dashed "drop here" slot.
3. Moving the cursor into a different day collapses the previous active day back to its compact timeline and expands the new one. **Only one day is ever expanded at a time.**
4. The originating day is the initial active day, so the user has somewhere to drop within the source day. It collapses once the cursor leaves it.
5. Animations: day expand/collapse uses `motion`'s `AnimatePresence` + `layout`; cards reflowing inside the active day use dnd-kit's built-in sortable animations.

### On drop

| Drop target | Result |
|---|---|
| Slot between events inside a bucket cluster | `sortOrder = keyBetween(prev, next)` |
| End-of-bucket / empty bucket cluster | `sortOrder = keyAfter(lastInBucket)` or `keyBefore(null)` if empty |
| `day:N` region only (not a bucket) | Snap back, no write |
| Outside the rail entirely | Snap back, no write |

In all writeable cases, the patch sent to the server is `{ dayIndex, bucket, sortOrder }`.

## Data model

### Schema change

`itinerary_events.sort_order`: **`integer` → `text`**

Sort keys are base62 strings produced by the [`fractional-indexing`](https://www.npmjs.com/package/fractional-indexing) npm package (~1 KB). This is a LexoRank-style scheme: lexicographic comparison yields the correct order, and any midpoint can be expressed in a bounded string. Battle-tested by Jira and a number of similar reorder UIs.

**Why not numeric/double:** floats lose precision after ~50 sequential midpoint inserts in the same gap and require periodic rebalances. Strings avoid the issue.

**Why not integer rewrites per bucket:** every move would write N rows and race under concurrent edits.

### Migration

A single Drizzle migration:

1. `ALTER TABLE itinerary_events ADD COLUMN sort_order_text text;`
2. Backfill: for each `(trip_id, day_index, bucket)` group, order existing rows by the integer `sort_order` and assign keys via `generateNKeysBetween(null, null, count)`. Done in a SQL CTE so it's a single statement per group, or a one-shot script invoked by the migration if SQL gets ugly.
3. `ALTER TABLE itinerary_events DROP COLUMN sort_order;`
4. `ALTER TABLE itinerary_events RENAME COLUMN sort_order_text TO sort_order;`
5. Add a `NOT NULL` constraint after backfill.

New rows always provide a key (computed by the client or by `createItineraryEvent` defaulting to `keyAfter(lastInBucket)`).

### Type changes

- `src/db/schema.ts` — `sortOrder: text("sort_order").notNull()`
- `src/lib/trips/service.ts` — `ItineraryEventListItem.sortOrder: string`, same on create/update inputs
- `src/components/itinerary/types.ts` — `sortOrder: string`
- `src/components/itinerary/utils.ts` — sort comparator becomes `a.sortOrder.localeCompare(b.sortOrder)`

## Backend

### New route

`src/app/api/trips/[tripId]/itinerary/[eventId]/route.ts` — `PATCH` handler.

**Body (zod-validated):**

```ts
{
  dayIndex?: number,       // integer, ≥ 0
  bucket?: ItineraryEventBucket,
  sortOrder?: string,      // non-empty, base62-only
}
```

All three optional in principle; in practice the move always sends all three. Unknown fields rejected. Trip member access enforced via existing `assertTripMemberAccess`.

**Logic:** thin pass-through to `tripService.updateItineraryEvent(tripId, eventId, body)`. The service method already exists — only the `sortOrder` type changes from `number` to `string`.

### Sort key validator

New `src/lib/trips/sort-keys.ts` (shared between client and server):

```ts
export function isValidSortKey(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && /^[0-9A-Za-z]+$/.test(value);
}
```

Plus thin re-exports of `generateKeyBetween` / `generateNKeysBetween` for shared client/server use.

### Realtime

Out of scope. Leave a one-line comment in the PATCH handler indicating where a `socket.emit('itinerary:event:moved', ...)` call would slot in. SWR's revalidate-on-mount/focus is the only sync mechanism for v1.

## Frontend architecture

### Files

| File | Status | Purpose |
|---|---|---|
| `src/components/itinerary/itinerary-rail.tsx` | modified | Wrap children in `DndContext`. Own `activeDragId` + `activeOverDayIndex` state. Render `<DragOverlay>`. Dispatch the move on drop. |
| `src/components/itinerary/itinerary-day.tsx` | **new** | One day. Two rendering modes: `compact` (current continuous timeline) or `expanded` (5 bucket sections). Renders the timeline spine node + day header in both modes. |
| `src/components/itinerary/itinerary-bucket-section.tsx` | modified | The existing file is currently unused. Repurpose as the expanded-mode bucket cluster: `useDroppable` for the cluster id, `SortableContext` for its events, dashed empty-state slot. |
| `src/components/itinerary/itinerary-event-card.tsx` | modified | Wrap in `useSortable`. Whole card is the drag handle. `activationConstraint: { distance: 8 }` preserves click-to-select. |
| `src/components/itinerary/itinerary-drag-overlay.tsx` | **new** | The "shadow" card rendered via `DragOverlay` portal. Visually identical to a card with a subtle shadow + slight rotation. |
| `src/components/itinerary/sort-keys.ts` | **new** | Tiny wrapper around `fractional-indexing`: `keyBefore`, `keyAfter`, `keyBetween`, `validate`. Re-exports `isValidSortKey` from `lib/trips/sort-keys.ts`. |
| `src/components/itinerary/use-itinerary-move.ts` | **new** | Hook: `(eventId, { dayIndex, bucket, sortOrder }) => Promise<void>`. Mutates SWR cache, PATCHes, rolls back + toasts on error. |
| `src/lib/trips/sort-keys.ts` | **new** | Shared validator + re-exports of fractional-indexing helpers. |
| `src/app/api/trips/[tripId]/itinerary/[eventId]/route.ts` | **new** | PATCH handler. |
| `src/db/schema.ts` | modified | `sort_order` type change. |
| `drizzle/<next>_itinerary_sort_order_text.sql` | **new** | Migration described above. |
| `package.json` | modified | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing`. |

### Drag state machine

Lives in `itinerary-rail.tsx`:

```ts
const [activeDragId, setActiveDragId] = useState<string | null>(null);
const [activeOverDayIndex, setActiveOverDayIndex] = useState<number | null>(null);
```

- `onDragStart`: set `activeDragId` to the event id; set `activeOverDayIndex` to the source event's `dayIndex`.
- `onDragOver`: read the topmost droppable id from dnd-kit collision detection; parse its day-index segment; update `activeOverDayIndex` if changed. Throttled implicitly by dnd-kit's batching.
- `onDragEnd`: compute the new sort key from the drop target (see below), call `useItineraryMove`, reset both state values.
- `onDragCancel`: reset both state values.

### Droppable ID scheme

| ID pattern | Type | When it accepts a drop |
|---|---|---|
| `event:{eventId}` | sortable item | Drop adjacent → `keyBetween(prev, next)` |
| `bucket:{dayIndex}:{bucket}` | droppable zone | Drop into bucket → `keyAfter(last)` or `keyBefore(null)` |
| `day:{dayIndex}` | droppable region | Triggers expansion only; drop here = snap back |

The day-level droppable exists purely so we can detect "cursor entered this day" without requiring it to overlap a bucket zone. dnd-kit collision detection returns all matched droppables; we pick the most specific one for drop resolution but use `day:*` matches to drive expansion state.

### Collision detection

Custom collision detector: call `pointerWithin` first (cursor-centric, predictable for vertical lists with nested droppables); if it returns no hits, call `closestCenter` as a fallback. Both are exported by `@dnd-kit/core`; composing them is a small helper inside `itinerary-rail.tsx`.

### Sort key resolution on drop

In `use-itinerary-move`:

```ts
function computePatch(over, activeEvent, eventsByDayBucket) {
  if (over.id.startsWith("event:")) {
    const targetId = over.id.slice("event:".length);
    const targetEvent = findEvent(targetId);
    const { dayIndex, bucket } = targetEvent;
    const siblings = eventsByDayBucket[dayIndex][bucket];
    const targetIdx = siblings.indexOf(targetEvent);
    const insertAfter = over.rect.top + over.rect.height / 2 < pointerY;
    const prev = insertAfter ? targetEvent : siblings[targetIdx - 1] ?? null;
    const next = insertAfter ? siblings[targetIdx + 1] ?? null : targetEvent;
    return { dayIndex, bucket, sortOrder: keyBetween(prev?.sortOrder, next?.sortOrder) };
  }
  if (over.id.startsWith("bucket:")) {
    const [, dayIndexStr, bucket] = over.id.split(":");
    const dayIndex = Number(dayIndexStr);
    const siblings = eventsByDayBucket[dayIndex][bucket] ?? [];
    const last = siblings[siblings.length - 1];
    return { dayIndex, bucket, sortOrder: keyAfter(last?.sortOrder ?? null) };
  }
  return null; // day:* or no target → snap back
}
```

(Pseudocode; concrete impl will pull pointer Y from the drag event and handle the active event being excluded from its own neighbor list.)

### Optimistic update flow

`use-itinerary-move`:

1. Snapshot current SWR cache for `/api/trips/:tripId/itinerary`.
2. Mutate cache: update the target event's `{ dayIndex, bucket, sortOrder }`, re-sort the events array.
3. `fetch(PATCH …)`. On 2xx: revalidate. On error: restore snapshot, `toast.error("Couldn't move event")`.

Uses `useSWRConfig().mutate` with the rollback-on-throw pattern.

### Sensors

```ts
useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```

Accessibility: cards get `aria-roledescription="sortable"`. dnd-kit emits screen-reader announcements automatically; we provide a `<DndContext accessibility={{ announcements }}>` with itinerary-specific verbs ("moved to Morning, Day 3").

## Edge cases

1. **Drag activation vs. card click.** 8px activation distance preserves the existing click-to-select behavior. Touch long-press (200ms) preserves single-tap navigation.
2. **Empty days during drag.** Same expansion behavior — 5 empty bucket slots, no events. Outside a drag, empty days keep the current "No events planned" message.
3. **Source-day collapse on leave.** When the cursor leaves the source day, it collapses back to compact mode. The source card still exists in data (dnd-kit only hides its rendered slot), so re-entering re-expands cleanly.
4. **Snap-back.** Drop on `day:N` (not on a bucket) → no write. Drop outside rail → no write.
5. **The "anytime" bucket** is a normal bucket — fifth cluster, accepts drops like the others.
6. **Concurrent edits, no realtime.** Two users moving different items rarely conflict (different sort keys). Two users moving the *same* item: last-write-wins on the server, both clients converge on next SWR revalidate. Acceptable for v1.
7. **Saved-locations drag is a clean follow-up.** The `bucket:D:B` droppable already accepts any sortable. A future saved-location draggable would just live in a different id namespace; the drop handler branches on it to call create-event instead of move-event.

## Testing

- **Schema migration:** run on a seeded dev DB; verify all existing events get unique, lexically-ordered keys grouped by `(trip, day, bucket)`.
- **Service layer:** existing tests for `updateItineraryEvent` (if any) — extend with string sortOrder assertions.
- **API route:** unit-test the zod schema rejects bad bodies (negative dayIndex, unknown bucket, malformed sortOrder).
- **DnD UX:** manual checklist in the dev server — reorder within a bucket, move across buckets in the same day, move across days, drop on empty bucket, drop on empty day's bucket, snap-back on `day:N` drop, snap-back outside, keyboard navigation (space to pick up, arrows to move, space to drop).

## Open seams (not in v1, leave clean)

- Realtime broadcast on PATCH.
- Saved-locations rail drag-in.
- Bulk multi-select drag.
- Server-authoritative midpoint computation (currently client-side; would matter if we ever drop SWR or add server-side conflict resolution).
