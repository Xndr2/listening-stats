# Coding Conventions

**Analysis Date:** 2026-02-10

## Naming Patterns

**Files:**
- PascalCase for React components: `Header.tsx`, `TopLists.tsx`, `SetupScreen.tsx`
- camelCase for services and utilities: `spotify-api.ts`, `lastfm.ts`, `tracker.ts`, `storage.ts`
- camelCase for type definition files: `listeningstats.ts`, `spotify.ts`
- Barrel exports use `index.ts`: `src/components/index.ts`, `src/types/index.ts`, `src/services/providers/index.ts`

**Functions:**
- camelCase for all functions: `calculateStats()`, `getActiveProvider()`, `formatDuration()`, `navigateToUri()`
- Functional components use PascalCase: `Header()`, `TopLists()`, `AnimatedNumber()`
- Factory functions use `create` prefix: `createLocalProvider()`, `createLastfmProvider()`, `createStatsfmProvider()`
- Getter/checker functions use `get`/`is`/`has` prefix: `getSelectedProviderType()`, `isConnected()`, `hasExistingData()`
- Setter functions use `set` prefix: `setSelectedProviderType()`, `setLoggingEnabled()`
- Handlers use `handle` prefix: `handleLastfmSwitch()`, `handleStatsfmSelect()`
- Event/update functions use `on` prefix for callbacks: `onStatsUpdated()`, `onShare()`, `onToggleSettings()`

**Variables:**
- camelCase for all variables and constants: `statsCache`, `STATS_CACHE_TTL`, `STORAGE_KEY`, `activeProvider`
- UPPER_SNAKE_CASE for module-level constants: `DB_NAME`, `STORE_NAME`, `MAX_BATCH`, `CACHE_TTL_MS`, `DEFAULT_BACKOFF_MS`
- Prefix `is`/`has` for boolean flags: `isLoggingEnabled()`, `hasExistingData()`, `lfmConnected`
- Handler references stored in variables: `unsubStatsUpdate`, `pollInterval` (see `src/app/index.tsx` line 56-57)

**Types:**
- PascalCase for interfaces and types: `HeaderProps`, `SettingsPanelProps`, `SetupScreenProps`, `ListeningStats`, `PlayEvent`
- Record types use `Record<EnumType, ValueType>`: `Record<ProviderType, string>` (see `src/app/components/Header.tsx` line 10)
- Suffixes for prop interfaces: `Props` — `TopListsProps`, `AnimatedNumberProps`

## Code Style

**Formatting:**
- Prettier 3.8.1 configured for the project (tool present but no explicit `.prettierrc` file in root)
- 2-space indentation (TypeScript/esbuild defaults)
- Single quotes avoided (uses double quotes in strings)
- Semicolons present on all statements
- Trailing commas in multi-line structures

**Linting:**
- No explicit ESLint config in root (relies on TypeScript strict checking)
- TypeScript compiler in "strict: false" mode but enforces "forceConsistentCasingInFileNames"
- `noImplicitAny: false` allows any types (loose inference)

**Line Length:**
- Generally kept under 100 characters
- JSX/HTML templates may exceed for readability (e.g., dynamic HTML attributes)

## Import Organization

**Order:**
1. Type imports from modules: `import type * from "idb"`, `import type { TrackingProvider } from "./types"`
2. Value imports from external packages: `import { openDB } from "idb"`
3. Service imports from local services: `import { calculateStats } from "../services/stats"`
4. Type imports from local types: `import { ListeningStats } from "../types"`
5. Component/UI imports: `import { Icons } from "../icons"`, `import { Header } from "./components"`
6. Utility imports: `import { navigateToUri } from "../utils"`

**Path Aliases:**
- Relative imports only: `../services/`, `../../types/`, `../icons`
- No path aliases configured in tsconfig

**Example from `src/app/components/TopLists.tsx`:**
```typescript
import { formatDuration } from "../../services/stats";
import { ListeningStats } from "../../types";
import { Icons } from "../icons";
import { getRankClass, lazyNavigate, navigateToUri } from "../utils";
```

## Error Handling

**Patterns:**
- Try-catch blocks for localStorage access (value may not persist):
```typescript
try {
  return localStorage.getItem(LOGGING_KEY) === "1";
} catch {
  return false;
}
```
- Try-catch with comment `/* ignore */` for intentionally ignored errors:
```typescript
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  // ...
} catch {
  /* ignore */
}
```
- Error logging with prefix `[ListeningStats]` for debugging:
```typescript
console.warn("[ListeningStats] Failed to load polling data:", error);
console.error("[ListeningStats] Failed to toggle like:", error);
```
- Async function try-finally for cleanup:
```typescript
try {
  const info = await LastFm.validateUser(...);
  // success
} catch (err: any) {
  setLfmError(err.message || "Connection failed");
} finally {
  setLfmValidating(false);
}
```
- Return fallback on error:
```typescript
export async function checkLikedTracks(trackUris: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (trackUris.length === 0) return result;
  try {
    // ...
  } catch (error) {
    console.error("[ListeningStats] Failed to check liked status:", error);
  }
  return result;
}
```

## Logging

**Framework:** `console` (global object)

**Patterns:**
- Conditional logging via `isLoggingEnabled()` check:
```typescript
function log(...args: any[]): void {
  if (isLoggingEnabled()) console.log("[ListeningStats]", ...args);
}
```
- `console.log()` for info with `[ListeningStats]` prefix
- `console.warn()` for warnings with context
- `console.error()` for errors with operation description
- Example: `console.log("[Listening Stats] Last.fm API key cleared. Reload the app to reconfigure.")`

## Comments

**When to Comment:**
- Data migration/schema changes: "if (oldVersion < 3) { ... }"
- Constants with units/ratios: `const PAYOUT_PER_STREAM = 0.004;`
- Non-obvious array trimming: "if (data.activityDates.length > 400)" — implicit limit reasoning
- API-specific behavior: rate limit handling, retry logic
- Intentional ignores: `/* ignore */` on catch blocks

**JSDoc/TSDoc:**
- Not used in this codebase
- Function/type documentation done through TypeScript interfaces and clear naming

## Function Design

**Size:**
- Functions typically 10-50 lines
- Longer functions reserved for complex async operations (e.g., `lastfmFetch()`, `handleLastfmSwitch()`)
- No single function exceeds 150 lines

**Parameters:**
- Destructured props for React components:
```typescript
export function TopLists({
  stats,
  likedTracks,
  onLikeToggle,
  showLikeButtons = true,
  period = "",
}: TopListsProps) {
```
- Default parameters in function signatures: `duration = 800`, `format = undefined`
- Rest operators rarely used (data structures prefer explicit fields)

**Return Values:**
- Explicit return types in signatures: `Promise<ListeningStats>`, `Map<string, boolean>`
- Early returns for guard clauses:
```typescript
if (trackUris.length === 0) return result;
if (!provider) {
  throw new Error("No tracking provider active");
}
```
- Chained returns from callbacks/event handlers

## Module Design

**Exports:**
- Named exports for functions/types:
```typescript
export function calculateStats(period: TimePeriod): Promise<ListeningStats> { }
export async function addPlayEvent(event: PlayEvent): Promise<void> { }
export type { TrackingProvider } from "./types";
```
- Mixed named + type exports allowed (no distinction)
- Default exports never used

**Barrel Files:**
- Centralized re-exports for components:
```typescript
// src/app/components/index.ts
export { UpdateBanner } from "./UpdateBanner";
export { Footer } from "./Footer";
export { SettingsPanel } from "./SettingsPanel";
```
- Centralized re-exports for types:
```typescript
// src/types/index.ts
export * from "./listeningstats";
export * from "./spotify";
```

## React Patterns

**Functional Components:**
- Declared as named functions: `export function Header({ ... }: HeaderProps) { }`
- Props fully typed via interfaces
- No arrow function syntax for component declarations

**Class Components:**
- Used for complex state management (e.g., `src/app/index.tsx`):
```typescript
class StatsPage extends Spicetify.React.Component<{}, State> {
  private pollInterval: number | null = null;
  private unsubStatsUpdate: (() => void) | null = null;
}
```
- Destructs React from Spicetify global: `const { useState, useEffect, useRef } = Spicetify.React;`

**Hooks:**
- Accessed via global Spicetify: `const { useState } = Spicetify.React;`
- Not imported from react package (React is global in Spicetify extensions)

**Event Handlers:**
- Inline arrow functions with void/callback return:
```typescript
onClick={(e) => onLikeToggle(t.trackUri, e)}
onClick={() => navigateToUri(t.trackUri)}
dangerouslySetInnerHTML={{ __html: Icons.settings }}
```
- Named handlers for complex logic: `handleLastfmSwitch()`, `handleLocalSelect()`

## State Management

**Local State:**
- React hooks (useState) for UI state in functional components
- Class component state via setState for app-wide state
- localStorage for persistent configuration (`listening-stats:provider`, `listening-stats:lastfm`)
- IndexedDB for large historical data (play events)

**Caching Pattern:**
- In-memory Map with TTL: `Map<string, { data: T; expiresAt: number }>`
- Used in `stats.ts` (120s), `lastfm.ts` (300s), `spotify-api.ts` (300s)
- Export `clear[*]Cache()` functions for manual invalidation

**Provider Pattern:**
- Active provider instance stored in module-level variable: `let activeProvider: TrackingProvider | null = null`
- Accessed via `getActiveProvider()` throughout app
- Destroyed and replaced on provider switch

## Constants & Configuration

**API Configuration:**
- Base URLs as module constants: `const LASTFM_API_URL = "https://..."`
- Timeouts/delays as UPPER_SNAKE_CASE: `SKIP_THRESHOLD_MS`, `CACHE_TTL_MS`, `MAX_BATCH`
- Keys for localStorage/IndexedDB: `const STORAGE_KEY = "listening-stats:..."`

**UI Configuration:**
- Provider names in Record literal:
```typescript
const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: "Local Tracking",
  lastfm: "Last.fm",
  statsfm: "stats.fm",
};
```

---

*Convention analysis: 2026-02-10*
