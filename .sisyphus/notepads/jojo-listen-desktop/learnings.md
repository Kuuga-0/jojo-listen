# jojo-listen-desktop learnings

## Wave 1 - Project Scaffold

### 2026-04-21
- Created project directory structure
- Inherited wisdom from context:
  - Tauri v2 uses `convertFileSrc` for local file access
  - `setIgnoreCursorEvents` has bug #11052 - avoid using it
  - Testing strategy: TDD (red-green-refactor)

### Notes
- Windows platform (win32)
- Using pnpm as package manager

## Task Completion Details

### What was created:
- `package.json` - with all dependencies (subsrt-ts, vitest, @testing-library/*, jsdom)
- `src-tauri/tauri.conf.json` - frameless, alwaysOnTop, minWidth:320, minHeight:200, CSP with http/https
- `src-tauri/Cargo.toml` - with plugins: fs, dialog, sql, keychain, global-shortcut, window-state
- `vitest.config.ts` - jsdom environment, React testing library support
- `src/__tests__/setup.test.tsx` - basic test verifying React rendering
- `src/lib/{subtitle,player,llm,storage,stealth}/` - directory structure with placeholder index.ts

### Issues encountered:
- `tauri.conf.json` does NOT support `devtools` in `build` section (Tauri v2 schema)
- `pnpm create tauri-app` requires empty directory - had to use temp dir workaround
- Windows PowerShell doesn't support `&&` operator - use `-Workdir` parameter instead
- `tsconfig.node.json` was missing - created minimal config referencing it from tsconfig.json

### Verification:
- `pnpm test` (vitest run) passes with 2 tests
- `pnpm tauri dev` successfully starts (Vite dev server + Cargo compile begins)

## Wave 1 - Task 5: HTML5 Video 播放验证 Demo

### What was created:
- `src-tauri/src/lib.rs` - added `convert_file_src` command using `tauri::path::PathResolver::convert_file_src`
- `src/lib/player/video.ts` - `convertFileSrc(path)` function calling Tauri invoke, `PLAYBACK_RATES` constant
- `src/components/VideoDemo.tsx` - Video player demo with file select, play/pause, playback rate (0.5x-1.5x)
- `src/lib/player/__tests__/convertFileSrc.test.ts` - 13 tests for convertFileSrc and PLAYBACK_RATES
- Updated `vitest.config.ts` - added `src/lib/**/*.test.ts` to include pattern

### Issues encountered:
- The `convert_file_src` function in lib.rs was missing after initial edit (concurrent modification?)
- Re-added the function to ensure it was present
- LSP diagnostics timed out on initialize (environment issue, not code issue)

### Verification:
- `pnpm vitest run src/lib/player` passes with 13 tests
- `pnpm vitest run` passes with 15 tests total (13 new + 2 existing)

### Key findings:
- Tauri v2 `convert_file_src` is accessed via `tauri::path::PathResolver::convert_file_src(path)`
- Vitest config needs explicit include pattern for tests outside `src/__tests__/`
- HTML5 video in Tauri WebView requires `convertFileSrc` to generate proper `file://` URLs

## Wave 1 - Task 2: SQLite Schema + 数据迁移

### What was created:
- `src-tauri/src/db/mod.rs` - 数据库模块，包含迁移和CRUD
- `src-tauri/src/db/migrations.rs` - 迁移执行器
- `src-tauri/src/db/models.rs` - 数据模型定义 (Video, Subtitle, WatchProgress, LlmCache, AbLoop, Setting)
- `src-tauri/migrations/001_initial.sql` - 初始迁移SQL

### Database Tables:
- `videos` - 视频文件信息
- `subtitles` - 字幕文件
- `watch_progress` - 播放进度
- `llm_cache` - LLM响应缓存
- `ab_loops` - AB循环点
- `settings` - 键值存储

### Architecture:
- 迁移系统：检查 schema_migrations 表版本 → 执行增量迁移
- 使用 rusqlite 直接管理SQLite (tauri-plugin-sql 用于前端JS)
- 在 lib.rs 的 .setup() 中初始化数据库

### Issues encountered:
- Windows 缺少 MSVC linker，无法执行 cargo build/test --all-targets
- 测试代码已写好但无法在当前环境编译验证

### Key findings:
- Tauri 后端使用 rusqlite 直接操作数据库，前端通过 tauri-plugin-sql 使用 JS
- rusqlite bundled feature 自带 SQLite 源码，无需系统库
- 迁移文件从 `{app_data_dir}/migrations/` 目录读取
- 使用 tempfile crate 进行集成测试
## Wave 1 - Task 3: LLM API Proxy

### What was created:
- `src-tauri/src/llm/mod.rs` - Tauri command `analyze_sentence` with retry logic (max 3 retries, exponential backoff 1s→2s→4s→8s, max 10s), 30s timeout, OpenAI-compatible chat completion API
- `src-tauri/src/llm/types.rs` - `LLMResponse`, `UsageContext`, `GrammarNote`, `VocabularyItem` structs matching TypeScript interface; internal `ChatCompletionRequest`, `ChatMessage`, `ResponseFormat`, `ChatCompletionResponse` types
- `src/lib/llm/types.ts` - TypeScript `LLMResponse` interface with `UsageContext`, `GrammarNote`, `VocabularyItem`
- `src/lib/llm/api.ts` - `analyzeSentence()` helper that retrieves API key from keychain then calls `invoke('analyze_sentence', ...)`
- `src/lib/llm/index.ts` - Re-exports from api.ts and types.ts
- `src/lib/llm/__tests__/api.test.ts` - 7 frontend tests (mock invoke + keychain)

### Files modified:
- `src-tauri/src/lib.rs` - Added `mod llm;` and registered `llm::analyze_sentence` in invoke_handler; fixed `convert_file_src` to use `asset://localhost/` protocol
- `src-tauri/Cargo.toml` - Added `reqwest = { version = "0.12", features = ["json"] }` and `tokio = { version = "1", features = ["time"] }`
- `src-tauri/capabilities/default.json` - Fixed keychain permission names (`keychain:allow-get-item`, `keychain:allow-save-item`, `keychain:allow-remove-item`)
- `src-tauri/src/db/migrations.rs` - Fixed `?` operator error by adding explicit `.map_err()` conversion for `std::io::Error` → `rusqlite::Error`
- `package.json` - Added `tauri-plugin-keychain` npm dependency

### Architecture decisions:
- API key passed as parameter from frontend (retrieved from keychain via `getItem('jojo-listen-api-key')`) since `tauri-plugin-keychain` has no Rust API
- API URL and model retrieved from SQLite `settings` table via `db::get_setting()` with defaults (`https://api.openai.com/v1` and `gpt-4o-mini`)
- System prompt instructs LLM to return JSON with `response_format: { type: "json_object" }`
- Auth errors (401/403) return immediately without retry
- `convert_file_src` fixed: Tauri v2 doesn't expose `PathResolver::convert_file_src` as static method; uses `asset://localhost/` protocol directly

### Issues encountered:
- `tauri-plugin-keychain` permission names in capabilities were wrong (`allow-get` → `allow-get-item`, etc.)
- Pre-existing compilation errors in `convert_file_src` (static method on PathResolver) and `migrations.rs` (io::Error → rusqlite::Error conversion) - both fixed
- `pub(crate)` visibility needed for internal struct fields in `types.rs` to be accessible from `mod.rs`

### Verification:
- `cargo test --lib -- llm::` passes with 14 tests
- `npx vitest run src/lib/llm` passes with 7 tests
- `npx tsc --noEmit` passes (no errors from LLM files)

## Wave 1 - Task 4: Subtitle Parser (SRT + ASS)

### What was created:
- `src/lib/subtitle/types.ts` - SubtitleCue interface and SubtitleFormat type
- `src/lib/subtitle/parser.ts` - Full subtitle parsing module with:
  - `parseSubtitle()` - Main entry point dispatching to SRT/ASS parsers
  - `parseSRT()` - SRT format parser with BOM handling, CRLF normalization, HTML tag stripping
  - `parseASS()` - ASS format parser with section detection, Format line parsing, ASS formatting code stripping
  - `detectSubtitleFormat()` - Auto-detect SRT vs ASS from content
  - `stripHtmlTags()` - Remove HTML tags like `<i>`, `<b>`, `<font>` from subtitle text
  - `stripBOM()` - Remove UTF-8 BOM (U+FEFF) from file content
  - `formatTime()` - Format seconds to SRT time format (HH:MM:SS,mmm)
  - `parseSRTTime()` - Parse SRT timestamps (HH:MM:SS,mmm) to seconds
  - `parseASSTime()` - Parse ASS timestamps (H:MM:SS.CC) to seconds
- `src/lib/subtitle/__tests__/parser.test.ts` - 28 tests for utility functions and auto-detection
- `src/lib/subtitle/__tests__/srt.test.ts` - 22 tests for SRT parsing
- `src/lib/subtitle/__tests__/ass.test.ts` - 21 tests for ASS parsing
- Updated `src/lib/subtitle/index.ts` - Re-exports all public functions and types

### Key findings:
- `String.prototype.split(',', limit)` in JS truncates the result array to `limit` elements, discarding remaining text. For ASS parsing where the Text field can contain commas, must split without limit and manually rejoin the text field: `allFields.slice(textIdx).join(',')`
- ASS Format line defines field order; must parse it to correctly map Dialogue fields
- ASS `{\N}` = newline, `{\n}` = space, `{\h}` = hard space, `{\b1}` etc. = formatting codes
- SRT uses comma as millisecond separator (`00:00:01,000`), ASS uses period for centiseconds (`0:00:01.00`)
- BOM character (U+FEFF) commonly appears in subtitle files saved on Windows
- TypeScript strict mode flags unused variables (`noUnusedLocals`) - removed `BOM` constant and `idLine` variable

### Verification:
- `npx vitest run src/lib/subtitle` passes with 82 tests (3 test files)
- `npx vitest run` passes with 104 tests total (82 new + 22 existing)
- `npx tsc --noEmit` passes with no errors

## Wave 1 - Task 8: Keyboard Shortcuts System

### What was created:
- `src/hooks/useKeyboardShortcuts.ts` - React hook for global keyboard shortcuts with OSD feedback
- `src/hooks/__tests__/useKeyboardShortcuts.test.ts` - 35 comprehensive tests
- Updated `vitest.config.ts` - Added `src/hooks/**/*.test.ts` to include pattern

### Architecture:
- Hook accepts `ShortcutCallbacks` interface with 15 callback functions
- Uses `useRef` for callbacks to avoid re-registering event listeners on every render
- Uses `useCallback` for `showOsd` and `handleKeyDown` for stable references
- `isInputElementFocused()` checks `input`, `textarea`, and `contentEditable` elements
- Escape key always works, even when an input element is focused - critical UX decision
- OSD messages auto-dismiss after 2 seconds via `setTimeout`
- New OSD message cancels previous timer and starts fresh

### Key findings:
- jsdom doesn't properly handle `focus()` on `contentEditable` div elements - must mock `document.activeElement` getter
- jsdom doesn't properly reset `document.activeElement` on `blur()` - must mock for focus/blur transition tests
- `isContentEditable` property may not be computed correctly in jsdom; fallback to checking `contentEditable === 'true'` for robustness
- `vi.spyOn(document, 'activeElement', 'get').mockRestore()` properly restores the original getter
- Vitest include patterns need explicit entries for each new directory (`src/hooks/**/*.test.ts`)
- Pre-existing TypeScript errors in `useVideoSync.ts` (`onTimeUpdate` should be `ontimeupdate`) and `VideoPlayer.tsx` (unused `videoPath` variable)

### Keyboard mapping:
- Space: play/pause, ArrowLeft/Right: seek ±5s, ArrowUp/Down: prev/next subtitle
- 1/2/3/4: A-B loop (set A, set B, toggle, clear)
- [/]: decrease/increase speed
- Escape: close/exit (always active, even in inputs)
- s: stealth mode, t: click-through, ,: settings

### Verification:
- `npx vitest run src/hooks/__tests__/useKeyboardShortcuts.test.ts` passes with 35 tests
- `npx tsc --noEmit` shows no errors in new files (pre-existing errors in other files)

## Wave 2 - Task 6: Video Player Component + File Import Flow

### What was created:
- `src/hooks/useVideoSync.ts` - Hook that syncs video currentTime with subtitle cue detection using RAF + timeupdate + seeked events, debounced to 100ms
- `src/components/VideoPlayer.tsx` - Video player component with:
  - File import via `@tauri-apps/plugin-dialog` (video: .mp4/.webm/.mkv, subtitle: .srt/.ass)
  - Playback state machine: idle → playing ↔ paused → ended
  - `useImperativeHandle` exposing: play(), pause(), seek(), setPlaybackRate(), getCurrentTime(), setVolume()
  - Subtitle import with auto-detect format using `detectSubtitleFormat` + `parseSubtitle`
  - Progress bar, time display, play/pause, playback rate, volume controls
- `src/hooks/__tests__/useVideoSync.test.ts` - 12 tests for time sync, cue detection, boundary cases, cleanup
- `src/components/__tests__/VideoPlayer.test.tsx` - 16 tests for render states, import flow, imperative handle, callbacks
- Updated `src/App.tsx` - Replaced default Tauri template with VideoPlayer integration
- Updated `vitest.config.ts` - Added `src/components/**/*.test.tsx` to include patterns
- Added `@tauri-apps/plugin-dialog` npm dependency

### Key findings:
- `@tauri-apps/plugin-dialog` `open()` returns `string | null` when `multiple: false`
- `convertFileSrc` + `fetch` can be used to read subtitle file content in Tauri webview
- `vi.stubGlobal('fetch', ...)` is the correct way to mock global.fetch in Vitest (not `global.fetch = ...`)
- `screen.getByText(/import video/i)` can match multiple elements (placeholder text + button text) - use `screen.getByRole('button', { name: /pattern/ })` for specificity
- `useVideoSync` uses dual sync: RAF loop for smooth playback + timeupdate/seeked events as fallback
- At exact boundary times (e.g., time=3 where cue1 ends at 3 and cue2 starts at 3), the first matching cue wins per the `findActiveCueIndex` linear scan
- jsdom renders inline styles differently from browser - `backgroundColor: 'rgb(51, 51, 51)'` may not match `style*="backgroundColor"` selectors in tests
- TypeScript strict mode flags unused variables (`noUnusedLocals`) - removed `videoPath` state that was set but never read

### Verification:
- `npx vitest run` passes with 167 tests (28 new + 139 existing)
- `npx tsc --noEmit` passes with no new errors (pre-existing `segmenter.ts` error excluded)

## Wave 1 - Task 9: English Word Segmentation Module

### What was created:
- `src/lib/subtitle/segmenter.ts` - Word segmentation module with:
  - `WordSegment` interface (word, isPunctuation, startIndex, endIndex)
  - `segmentWords(text)` - Primary: Intl.Segmenter with post-processing; Fallback: char-by-char parsing
  - `isContraction(word)` - Checks contraction suffixes (n't, 'm, 're, 's, 've, 'll, 'd)
  - `isPunctuation(char)` - Checks against PUNCTUATION_CHARS set
- `src/lib/subtitle/__tests__/segmenter.test.ts` - 55 tests covering:
  - isContraction (7 tests), isPunctuation (4 tests)
  - Basic segmentation, contractions, punctuation, numbers, hyphens, empty/whitespace, case, indices, edge cases
  - Fallback mechanism (9 tests with Intl.Segmenter mocked as undefined)
- Updated `src/lib/subtitle/index.ts` - Re-exports segmentWords, WordSegment, isContraction, isPunctuation

### Key findings:
- `Intl.Segmenter` types are NOT in ES2020 TypeScript lib — must access via bracket notation `(Intl as any)['Segmenter']` to avoid compile errors
- `Intl.Segmenter` with `granularity: 'word'` splits contractions: "don't" → "don" + "'" + "t" — requires post-processing to re-merge
- Multi-hyphen compounds ("state-of-the-art") need greedy chaining, not single 3-segment merge windows
- Contractions and decimal numbers are single-merge operations; only hyphens chain greedily
- Fallback path naturally distinguishes "hello-world" (one word) vs "hello - world" (three segments) because it reads original text char-by-char; Intl.Segmenter path cannot distinguish after whitespace filtering
- `new` keyword required when calling SegmenterConstructor — TypeScript enforces constructor signature
- `import type { WordSegment }` needed for type-only imports to avoid TS6133 (noUnusedLocals)

### Architecture decisions:
- Contraction merge: check combined word with `isContraction()` before merging — prevents false merges like "rock'n"
- Decimal merge: only when both sides are all digits — prevents "Hello.world" from merging
- Hyphen merge: always chain greedily — any word-hyphen-word sequence becomes one compound
- Contraction/decimal merges are NOT chained with hyphens — contractions are complete words

### Verification:
- `npx vitest run src/lib/subtitle/segmenter` passes with 55 tests
- `npx vitest run src/lib/subtitle` passes with 137 tests (82 existing + 55 new)
- `npx tsc --noEmit` passes with no errors

## Wave 2 - Task 7: Subtitle Sync Rendering with 4 Display Modes

### What was created:
- `src/components/SubtitleRenderer.tsx` - Subtitle renderer component with:
  - 4 display modes: `word-segmented`, `word-segmented-translation`, `plain`, `plain-translation`
  - Word segmentation using `segmentWords()` from segmenter module
  - Current word highlighting based on calculated word timing
  - Click handler for word interaction in word-segmented modes
  - Translation display from `translationMap` (sentence → translation)
  - Fade in/out transition animation (200ms)
  - Gap handling (no subtitle shown between cues)
  - Next cue preloading via `data-next-cue-index` attribute
- `src/components/__tests__/SubtitleRenderer.test.tsx` - 24 comprehensive tests covering:
  - Rendering in all 4 display modes
  - Word segmentation rendering
  - Current word highlighting with time progression
  - Click handler functionality
  - Gap handling (no cue active)
  - Transition animation styles
  - Empty cues array handling
  - Translation map integration
  - Data attributes for cue indices
- `src/__tests__/setup.ts` - Jest-dom setup file for testing matchers
- Updated `vitest.config.ts` - Added `setupFiles` configuration

### Architecture decisions:
- Word timing calculation: Evenly distribute cue duration across words
- Punctuation timing: Gets timing from previous word (no separate timing)
- Active word detection: Uses `>=` for start, `<` for end (exclusive end)
- Translation source: Comes from LLM via `translationMap`, not from subtitle file
- Display modes: Word-segmented modes show individual clickable words, plain modes show full text
- Transition: CSS `opacity` with `transition: 200ms ease-in-out`

### Key findings:
- Vitest requires `setupFiles` configuration to import `@testing-library/jest-dom` matchers
- Jest-dom matchers (`toHaveAttribute`, `toHaveStyle`, `toHaveTextContent`, `toBeInTheDocument`) are essential for React component testing
- Word timing at exact boundaries (e.g., `currentTime === wordEndTime`) doesn't highlight that word due to `<` comparison
- Mock `segmentWords` function needs to properly handle punctuation detection for accurate timing calculation
- `data-testid` attributes are useful for test selectors without relying on text content
- Inline styles in React components work correctly with jest-dom `toHaveStyle` matcher

### Verification:
- `npx vitest run src/components/__tests__/SubtitleRenderer.test.tsx` passes with 24 tests
- `npx tsc --noEmit` passes with no errors

## Wave 2 - Task 11: LLM Analysis Card UI

### What was created:
- `src/components/AnalysisCard.tsx` - Analysis card component with:
  - Props interface: `response`, `isLoading`, `error`, `onClose`, `onRetry`
  - Dark frosted glass style: `rgba(20, 20, 30, 0.85)` + `backdrop-filter: blur(20px)`
  - Full-screen overlay over video area (position: absolute, inset: 0)
  - Smooth enter/exit animation (fade + slide up, 200ms)
  - ESC key handling to close card
  - Loading state: skeleton screen with animated pulse + spinner
  - Error state: friendly error message + retry button
  - Empty state: nothing rendered when response is null and not loading/error
  - Scrollable content area for long responses
  - Renders LLM response fields:
    - Translation: prominent display at top (large font, accent color)
    - Usage Context: list of `{ example, explanation }` items
    - Grammar Notes: list of `{ point, explanation }` items
    - Vocabulary: list of `{ word, definition, pronunciation }` items
- `src/components/__tests__/AnalysisCard.test.tsx` - 14 comprehensive tests covering:
  - Empty state (nothing rendered)
  - Loading state (spinner + skeleton)
  - Error state (message + retry button)
  - Normal data rendering (all LLM response fields)
  - Close button click
  - ESC key press
  - Overlay click (close)
  - Card content click (no close)
  - Empty arrays handling
  - Long content scrolling
  - Error state with existing response
  - Loading state with existing response
  - Error state without onRetry callback

### Architecture decisions:
- Animation: CSS transitions with `opacity` and `transform` for smooth enter/exit
- ESC key handling: Added via `useEffect` with document event listener
- Close animation: 200ms delay before calling `onClose` callback
- Empty state: Returns `null` when no response, not loading, and no error
- CSS keyframes: Injected via `document.createElement('style')` for spinner and pulse animations
- Overlay click: Closes card, but card content click is stopped with `e.stopPropagation()`

### Key findings:
- jsdom renders inline styles differently from browser - avoid exact style value assertions
- `backdrop-filter` requires `-webkit-backdrop-filter` prefix for Safari compatibility
- CSS keyframes for animations need to be injected into document head for jsdom
- `waitFor` is needed for async callbacks (animation delays) in tests
- Multiple elements with same text can cause `getByText` to fail - use more specific selectors
- `screen.getByText('Translation').closest('div')` pattern useful for finding parent containers
- Animation state management: `isVisible` and `isExiting` states control CSS transitions

### Verification:
- `npx vitest run src/components/__tests__/AnalysisCard.test.tsx` passes with 14 tests
- `npx tsc --noEmit` passes with no errors

## Wave 2 - Task 10: A-B Loop + Playback Speed Control

### What was created:
- `src/hooks/useABLoop.ts` - A-B loop state machine hook with:
  - State machine: idle → a_set → ab_set → looping → idle
  - `setAPoint(time)` / `setBPoint(time)` with snap-to-subtitle feature
  - `startLoop()` / `stopLoop()` / `clearLoop()` transitions
  - Dual detection: timeupdate (~4Hz) + requestAnimationFrame (60Hz)
  - 200ms cooldown after loop jumps to prevent re-triggering
  - Margin tolerance: START_MARGIN=0.3s, END_MARGIN=0.5s
  - Video ended event stops loop (ended takes priority)
  - OSD messages with 2s auto-dismiss
- `src/hooks/usePlaybackRate.ts` - Playback speed control hook with:
  - 5 presets from PLAYBACK_RATES: [0.5, 0.75, 1.0, 1.25, 1.5]
  - `increaseSpeed()` / `decreaseSpeed()` cycling through presets
  - `setSpeed(rate)` for direct preset selection
  - Boundary protection (min/max indicators in OSD)
  - Applies rate to video.playbackRate directly
  - OSD messages with 2s auto-dismiss
- `src/hooks/__tests__/useABLoop.test.ts` - 34 tests covering:
  - Initial state, setAPoint, setBPoint, startLoop, stopLoop, clearLoop
  - State machine transitions (all valid paths)
  - Edge cases: A > B rejection, B before A rejection, B without A
  - Snap-to-subtitle for both A and B points
  - Loop detection: jump back at B, jump forward at A, within-range no-op
  - Cooldown after loop jump
  - Video ended event stops loop
  - OSD message auto-dismiss and replacement
  - Cleanup (event listener removal, rAF cancellation)
  - Full workflow integration test
- `src/hooks/__tests__/usePlaybackRate.test.ts` - 21 tests covering:
  - Initial state, all presets exposed
  - increaseSpeed cycling, boundary at max
  - decreaseSpeed cycling, boundary at min
  - setSpeed with valid/invalid rates
  - OSD messages, auto-dismiss, replacement
  - Full boundary traversal (min→max→min)
  - Works with null video ref

### Architecture decisions:
- A-B loop uses `setState` with functional updater to avoid stale closure issues in loop detection
- Loop detection runs inside `setState` callback to always have latest state
- rAF loop runs continuously but checks state internally (only acts when status === 'looping')
- Effect dependency on `state.status` ensures rAF loop restarts when status changes
- Playback rate uses `setState` functional updater for increase/decrease to avoid stale state
- Both hooks follow the same OSD pattern as `useKeyboardShortcuts` (2s auto-dismiss timer)

### Key findings:
- `setState` functional updater is essential for loop detection callbacks that read current state
- rAF loop must be started/stopped via effect cleanup to prevent memory leaks
- `performance.now()` used for cooldown tracking (not `Date.now()`) for consistency with rAF timing
- When A > B is rejected, the state is unchanged and an error OSD message is shown
- `PLAYBACK_RATES` is a readonly tuple type (`as const`), so `PlaybackRate` is a union of literal types
- `setSpeed` validates that the rate is one of the preset values before applying

### Verification:
- `npx vitest run src/hooks/__tests__/useABLoop.test.ts src/hooks/__tests__/usePlaybackRate.test.ts` passes with 55 tests
- `npx vitest run` passes with 315 tests total (55 new + 260 existing)
- `npx tsc --noEmit` passes with no errors

## Wave 2 - Task 12: Subtitle Analysis Hook

### What was created:
- `src/hooks/useSubtitleAnalysis.ts` - Hook managing subtitle click → LLM analysis flow with:
  - `analyzeWord(word, cue, allCues)` - Handles word click: pauses video, builds context, triggers analysis
  - `analyzeSentence(sentence, context)` - Direct sentence analysis
  - `closeAnalysis()` - Clears all analysis state
  - `retry()` - Retries last failed request
  - Cache integration via `invoke('get_llm_cache')` and `invoke('save_llm_cache')`
  - In-flight request deduplication using `Map<string, Promise<LLMResponse>>`
  - State management: `analysisResponse`, `isLoading`, `error`, `activeAnalysisCue`
  - Context building: 2 cues before and after the active cue
  - DJB2 hash function for cache keys from sentence text
- `src/hooks/__tests__/useSubtitleAnalysis.test.ts` - 30 comprehensive tests covering:
  - Initial state verification
  - Word click → pause video callback
  - Context building (2 cues before/after, edge cases at list boundaries)
  - Cache hit returns immediately without loading state
  - Cache miss → LLM request with loading state
  - Request deduplication: concurrent clicks on same sentence only send one request
  - Different sentences send separate requests
  - Error state handling with custom and generic messages
  - Retry functionality (success and no-op cases)
  - Close analysis clears all state
  - Loading state transitions (idle → loading → success/error)

### Architecture decisions:
- Cache checked first (fast path) before in-flight deduplication - reduces duplicate requests when user rapidly clicks
- In-flight deduplication only happens after cache miss - prevents concurrent identical requests
- Cache save is fire-and-forget (`void invoke()`) - don't block UI on cache write
- Context building falls back to single cue when cue not found in allCues (defensive coding)
- DJB2 hash algorithm chosen for fast, deterministic hashing without crypto API dependency
- Unused `word` parameter prefixed with `_` to satisfy TypeScript `noUnusedLocals`

### Key findings:
- React state updates from async callbacks need `await Promise.resolve()` after `act()` in tests to allow state to settle
- Testing async loading states requires wrapping the async operation in `act(async () => { ... await Promise.resolve() })`
- `void invoke(...)` explicitly ignores promise to avoid floating promise warnings
- Map references must use `.current` for in-flight request tracking in React hooks
- When deduplicating, the in-flight promise is awaited and result is set to state - second caller gets same result
- The unused `word` parameter in `analyzeWord` is kept for API consistency with `SubtitleRenderer`'s `onWordClick`

### Integration points:
- Works with `SubtitleRenderer` via `onWordClick(word, cue)` callback pattern
- Works with `AnalysisCard` component via `analysisResponse`, `isLoading`, `error` props
- Works with video player via `onPauseVideo` callback option
- Works with keyboard shortcuts via `onEscape` → `closeAnalysis()` pattern
- Cache backend expects `get_llm_cache` and `save_llm_cache` Tauri commands (to be implemented in Rust)

### Verification:
- `npx vitest run src/hooks/__tests__/useSubtitleAnalysis.test.ts` passes with 30 tests
- `npx tsc --noEmit` shows no errors in new files (pre-existing errors in other files)

## Wave 2 - Task 15: Settings Panel

### What was created:
- `src/components/SettingsPanel.tsx` - Settings panel component with 3 tabs:
  - **LLM Config tab**: API URL input, Model name input, API Key input (masked via keychain), "Test Connection" button, "Save" button
  - **Keybindings tab**: Display-only list of all keyboard shortcuts (15 shortcuts)
  - **Display tab**: Default subtitle mode dropdown (4 modes), Playback speed dropdown (5 presets), OSD toggle
- `src/components/__tests__/SettingsPanel.test.tsx` - 37 comprehensive tests covering all functionality
- Modified `src-tauri/src/db/commands.rs` - Added `get_setting` and `set_setting` Tauri commands
- Modified `src-tauri/src/lib.rs` - Registered new commands in invoke_handler
- Fixed `src-tauri/src/main.rs` - Corrected corrupted library path

### Architecture decisions:
- API key stored via `tauri-plugin-keychain` (`getItem`/`saveItem`/`removeItem`) - NOT in SQLite
- Other settings (api_url, model, subtitle_mode, playback_speed, osd_enabled) stored via SQLite `invoke('get_setting')`/`invoke('set_setting')`
- API connection test: sends minimal request to configured API URL to verify connectivity
- Dark frosted glass style: `rgba(20, 20, 30, 0.85)` + `backdrop-filter: blur(20px)` + `border-radius: 16px 0 0 16px` (slides from right)
- Settings panel is modal overlay that slides in from the right

### Pre-existing bugs fixed:
- `state.lock()` → `state.0.lock()` in commands.rs (DbState is a tuple struct)
- `main.rs` had corrupted path from temp directory creation

### Key findings:
- Tauri `State<S>` where `S` is a tuple struct requires `state.0.lock()` not `state.lock()`
- `vi.mock` is hoisted to module level - cannot change mock implementations dynamically in tests; use `vi.mocked(module).mockResolvedValue()` after import
- For testing `fetch`, use `vi.stubGlobal('fetch', vi.fn())` in beforeEach and `vi.unstubGlobal('fetch')` in afterEach
- Connection test requires `vi.stubGlobal` since it's a global, not a module import

### Verification:
- `pnpm vitest run src/components/__tests__/SettingsPanel.test.tsx` passes with 37 tests
- `npx tsc --noEmit` passes with no errors
- `cargo check` passes with only warnings (unused struct warnings)

## Wave 2 - Task 16: Dark Frosted Glass Theme System

### What was created:
- `src/theme/tokens.ts` - Design token definitions with:
  - `tokens` object: colors (bgPrimary, bgSecondary, bgTertiary, textPrimary, textSecondary, textMuted, accent, accentHover, error, success, warning, overlay, border, inputBg), radii (sm, md, lg), shadows (card, button), blur (md, lg), transitions (normal, slow), font (family, sizes xs/sm/md/lg/xl)
  - `cssVariables` object: Maps token values to CSS custom property names (e.g., `--bg-primary`, `--text-primary`, `--accent`)
  - TypeScript types: `ThemeTokens`, `CSSVariables`
- `src/theme/ThemeProvider.tsx` - React context provider with:
  - `ThemeProvider` component: Sets `data-theme="dark-frosted"` on `<html>`, injects CSS variables via `<style>` element, provides theme context
  - `useTheme()` hook: Returns `ThemeTokens` object, throws error if used outside ThemeProvider
  - Cleanup: Removes `data-theme` attribute and style element on unmount
- `src/theme/index.ts` - Re-exports tokens, ThemeProvider, useTheme, and types
- `src/theme/__tests__/ThemeProvider.test.tsx` - 5 tests covering:
  - Renders children correctly
  - Applies `data-theme="dark-frosted"` to document element
  - Injects CSS variables onto root element
  - `useTheme()` returns correct token values
  - `useTheme()` throws error when used outside ThemeProvider

### Components updated to use CSS variables:
- `src/App.tsx` - Wrapped with `<ThemeProvider>`
- `src/components/AnalysisCard.tsx` - Replaced 20+ hardcoded colors with CSS variables (bgPrimary, overlay, border, textPrimary, textSecondary, accent, inputBg, blur-md, radius-lg, shadow-card)
- `src/components/StealthMode.tsx` - Replaced 10+ hardcoded colors with CSS variables (bgPrimary, bgTertiary, textMuted, inputBg, blur-md, radius-sm)
- `src/components/SettingsPanel.tsx` - Replaced 25+ hardcoded colors with CSS variables (bgPrimary, overlay, border, textPrimary, textSecondary, accent, inputBg, error, success, blur-md, shadow-card)
- `src/components/VideoPlayer.tsx` - Replaced 15+ hardcoded colors with CSS variables (error, text-muted, border, input-bg, text-primary, text-secondary)
- `src/components/SubtitleRenderer.tsx` - No changes needed (colors are specific to subtitle display, not theme colors)

### Architecture decisions:
- CSS variables injected via `<style>` element in ThemeProvider useEffect
- `data-theme="dark-frosted"` attribute on `<html>` allows future theme variants
- Tokens object provides type-safe access to theme values via `useTheme()` hook
- CSS variables use `--` prefix convention (e.g., `--bg-primary`)
- Inline styles use `var(--token-name)` syntax for CSS variable references
- ThemeProvider wraps entire app at root level in App.tsx

### Key findings:
- React inline styles support CSS `var()` values as strings
- `document.documentElement.setAttribute('data-theme', ...)` is the standard way to set theme attribute
- CSS variables must be injected before components render to avoid flash of unstyled content
- ThemeProvider cleanup removes both `data-theme` attribute and injected `<style>` element
- Some components (SubtitleRenderer) have colors specific to their function (white text on dark background) that don't map to theme tokens
- Vitest test for CSS variable injection requires checking `document.styleSheets` for the injected rule
- `vi.spyOn(console, 'error').mockImplementation(() => {})` needed to suppress React error boundary warnings in tests

### Verification:
- `pnpm vitest run` passes with 448 tests (5 new + 443 existing)
- `npx tsc --noEmit` passes with no errors
- All existing component tests continue to pass after CSS variable migration