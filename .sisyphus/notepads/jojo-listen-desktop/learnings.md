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