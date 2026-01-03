# IMPORTANT: THIS TEMPLATE USED TO BE A WORKOUT APP CALLED FLEXI - WE CAN USE EXAMPLES OF FLEXI BUT SHOULD BE BUILDING PLANTAIN FROM SCRATCH AND CAN USE FLEXI AS A REFERENCE

## 1. Product Vision: The "Map OS"
We are building a collaborative, AI-native trip planning command center.
* **The Vibe:** A Google Maps "Command Center" — not a CRUD app.
* **The Metaphor:** "Glass Layers." The user is always on the map. We do not navigate *to* pages; we bring context *to* the user via floating panels, drawers, and overlays.
* **The User:** Groups of friends planning trips. They value speed, visual clarity, and real-time collaboration.

### Core UX Principles
1.  **No Navigated Nesting:** Avoid full-page transitions. Use URL query params (`?day=1`, `?place=xyz`) to control UI state (modals, drawers, filters). The map background never unmounts.
2.  **Spatial Interface:** If it has a location, it belongs on the map. Data lists (left panel) and Map markers (canvas) are two views of the same state. Interaction in one must instantly reflect in the other.
3.  **Optimistic Everything:** The UI never waits for the server. We mutate state instantly, then sync.