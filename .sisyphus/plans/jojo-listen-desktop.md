# JoJo Listen — 100LS 英语学习桌面应用

## TL;DR

> **Quick Summary**: 构建一个基于 Tauri v2 + React 的桌面英语学习应用，核心功能是导入本地视频+字幕，通过键盘控制播放（100LS方法论），点击字幕发送给LLM分析语法/翻译，支持上班隐蔽模式（纯字幕条/迷你播放器可切换）。
> 
> **Deliverables**:
> - Tauri v2 桌面应用，可导入MP4视频和SRT/ASS字幕
> - 4种字幕显示模式（分词/分词+翻译/普通/普通+翻译）
> - 键盘快捷键控制系统（播放/暂停/快进/快退/上下句/A-B循环）
> - A-B循环播放（核心100LS功能）
> - 播放速度控制（0.5x-1.5x）
> - 点击字幕→LLM分析（翻译+语境用法），暂停视频全屏展示
> - 双模式隐蔽：纯字幕条 ↔ 迷你播放器+字幕
> - 基础进度追踪（观看次数/播放位置/最后日期）
> - 暗色磨砂UI风格
> - Vitest单元测试 + Agent QA场景验证
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 → Task 5 → Task 8 → Task 12 → Task 14 → Task 18 → Final

---

## Context

### Original Request
受100LS学英语启发，想做桌面端+APP：导入视频和字幕，程序记录进度和次数，键盘操控播放，点击字幕发LLM分析。桌面端上班隐蔽使用（右下角小窗+纯字幕条），APP端小窗播放+灵动岛显示字幕。

### Interview Summary
**Key Discussions**:
- 平台策略: 桌面优先(Tauri v2)，移动端后续
- 技术栈: Tauri v2 + React + SQLite + subsrt-ts + 自定义OpenAI兼容API
- LLM交互: 点击字幕后暂停视频，全屏展示分析卡片（翻译+语境用法）
- 快捷键: 空格(播放/暂停)、←→(±5秒)、↑↓(上下句)、1-9(A-B循环点)
- 隐蔽模式: 双模式可切换（纯字幕条 ↔ 迷你播放器+字幕）
- UI风格: 暗色磨砂（深色背景+圆角+glassmorphism）
- 测试: TDD(红绿重构)，Vitest

**Research Findings**:
- 竞品(Language Reactor/Trancy)均不支持本地视频——核心差异化
- Tauri v2移动端可用但Dynamic Island需Swift原生插件
- `setIgnoreCursorEvents`有已知bug(#11052)会显示标题栏
- `srt-parser-2`和`subsrt-ts`是成熟字幕解析方案
- alwaysOnTop使用`setAlwaysOnTop(true, 'screen-saver')`
- `tauri-plugin-keychain`用于安全存储API Key（非明文）

### Metis Review
**Identified Gaps** (addressed):
- A-B循环UX细节: 数字键1-9的具体语义需明确 → 使用: 1=A点, 2=B点, 3=开始循环, 4=停止循环, 5=清除, [ = 减速, ] = 加速
- 隐蔽模式下LLM分析展示: 纯字幕条模式(100px高)无法全屏 → 切换到正常模式再展示
- API Key安全: 必须用OS Keychain存储 → 使用tauri-plugin-keychain
- 播放速度控制: 100LS核心需求，纳入MVP → 0.5x/0.75x/1.0x/1.25x/1.5x 五档
- 英文分词策略: 使用`@echogarden/text-segmentation`或`Intl.Segmenter`
- 字幕HTML标签: SRT中常见`<i>`等 → 解析时strip HTML
- `setIgnoreCursorEvents` bug: 使用无边框窗口绕过(decorations: false)
- 视频播放验证: 先验证HTML5 video播放本地MP4 → 失败则切换tauri-plugin-libmpv

---

## Work Objectives

### Core Objective
构建一个桌面英语学习应用，核心循环是：导入视频+字幕 → 键盘控制播放 → 点击字幕LLM分析 → 追踪学习进度。支持上班隐蔽使用的双模式切换。

### Concrete Deliverables
- `src-tauri/` — Rust后端（文件系统、LLM代理、Keychain、SQLite）
- `src/` — React前端（播放器、字幕渲染、分析卡片、设置面板）
- 完整的Vitest测试套件
- Tauri打包的可分发的桌面应用(Win/Mac)

### Definition of Done
- [ ] 导入本地MP4视频可正常播放
- [ ] 导入SRT/ASS字幕可正确解析和同步显示
- [ ] 4种字幕模式可切换且渲染正确
- [ ] 空格/方向键/数字键全部响应
- [ ] A-B循环功能工作（设置A点、B点、开始/停止循环、清除）
- [ ] 播放速度可在5档间切换
- [ ] 点击字幕发送LLM请求并展示分析结果
- [ ] 隐蔽模式可切换（纯字幕条 ↔ 迷你播放器）
- [ ] 学习进度可持久化到SQLite
- [ ] 所有Vitest测试通过

### Must Have
- 本地视频导入和播放
- SRT + ASS字幕解析与同步
- 4种字幕显示模式
- 键盘快捷键完整控制
- A-B循环播放（100LS核心）
- 播放速度控制（0.5x-1.5x）
- LLM分析（翻译+语境用法）
- 隐蔽双模式切换
- 进度持久化（SQLite）
- 暗色磨砂UI
- TDD: 每个功能先写测试
- API Key用OS Keychain安全存储

### Must NOT Have (Guardrails)
- 不写任何移动端代码（MVP阶段）
- 不引入libmpv/FFmpeg（除非HTML5 video验证失败）
- 不实现流式LLM响应（MVP用非流式JSON）
- 不创建多个Tauri窗口（用CSS切换模式而非多窗口）
- 不用regex做英文分词（用库或Intl.Segmenter）
- 不将API Key存在tauri-plugin-store或明文文件
- 不添加词频/CEFR/SRS功能（后续版本）
- 不支持在线视频或流媒体播放
- 不做云端数据同步

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO (绿地项目)
- **Automated tests**: YES (TDD — 红绿重构)
- **Framework**: Vitest + @testing-library/react
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Desktop App QA**: Use Playwright (playwright skill) — Launch Tauri dev, interact with UI, assert DOM, screenshot
- **Rust Backend**: Use Bash (cargo test) — Run unit tests, assert output
- **Frontend Logic**: Use Bash (vitest run) — Run unit tests, assert pass/fail
- **Integration**: Use Bash — Start app, test end-to-end flows via keyboard shortcuts

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - foundation + validation):
├── Task 1: Tauri v2 project scaffolding + Vitest config [quick]
├── Task 2: SQLite schema + migration setup [quick]
├── Task 3: LLM API proxy in Rust backend [deep]
├── Task 4: Subtitle parser (SRT + ASS) + BOM handling [deep]
└── Task 5: HTML5 video playback validation demo [quick]

Wave 2 (After Wave 1 - core modules, MAX PARALLEL):
├── Task 6: Video player component + import flow (depends: 1, 5) [unspecified-high]
├── Task 7: Subtitle sync & 4 display modes (depends: 4, 6) [visual-engineering]
├── Task 8: Keyboard shortcuts system (depends: 1) [unspecified-high]
├── Task 9: English word segmentation module (depends: 1) [deep]
├── Task 10: A-B loop + playback speed control (depends: 6, 8) [deep]
└── Task 11: LLM analysis card UI (depends: 3, 9) [visual-engineering]

Wave 3 (After Wave 2 - interaction + polish):
├── Task 12: Subtitle click → LLM request flow (depends: 7, 8, 11) [unspecified-high]
├── Task 13: Stealth dual-mode UI (depends: 6, 7) [visual-engineering]
├── Task 14: Progress tracking persistence (depends: 2, 6) [unspecified-high]
└── Task 15: Settings panel (LLM config, keybindings, display mode) (depends: 3, 8) [quick]

Wave 4 (After Wave 3 - integration + refinement):
├── Task 16: Dark frosted glass theme system (depends: 1) [visual-engineering]
├── Task 17: End-to-end integration: import → play → analyze → track (depends: 12, 14) [deep]
└── Task 18: Edge case handling + error boundaries (depends: 6-15) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 5 → Task 6 → Task 10 → Task 12 → Task 17 → Task 18 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | - | 6, 8, 9, 15, 16 | 1 |
| 2 | - | 14 | 1 |
| 3 | - | 11, 15 | 1 |
| 4 | - | 7 | 1 |
| 5 | 1 | 6 | 1 |
| 6 | 1, 5 | 7, 10, 14 | 2 |
| 7 | 4, 6 | 12, 13 | 2 |
| 8 | 1 | 10, 12 | 2 |
| 9 | 1 | 11 | 2 |
| 10 | 6, 8 | 12 | 2 |
| 11 | 3, 9 | 12 | 2 |
| 12 | 7, 8, 11 | 17 | 3 |
| 13 | 6, 7 | - | 3 |
| 14 | 2, 6 | 17 | 3 |
| 15 | 3, 8 | - | 3 |
| 16 | 1 | 17 | 4 |
| 17 | 12, 14 | 18 | 4 |
| 18 | 6-15 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: **5** — T1→`quick`, T2→`quick`, T3→`deep`, T4→`deep`, T5→`quick`
- **Wave 2**: **6** — T6→`unspecified-high`, T7→`visual-engineering`, T8→`unspecified-high`, T9→`deep`, T10→`deep`, T11→`visual-engineering`
- **Wave 3**: **4** — T12→`unspecified-high`, T13→`visual-engineering`, T14→`unspecified-high`, T15→`quick`
- **Wave 4**: **3** — T16→`visual-engineering`, T17→`deep`, T18→`unspecified-high`
- **FINAL**: **4** — F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

**Commit**: YES (groups with 1, 2, 3, 4)

- [ ] 6. 视频播放器组件 + 文件导入流程

  **What to do**:
  - 创建 `src/components/VideoPlayer.tsx`：核心视频播放器组件
  - 实现文件导入流程：
    - 使用 `tauri-plugin-dialog` 的 `open` 命令选择视频文件（过滤 .mp4/.webm/.mkv）
    - 使用 `tauri-plugin-dialog` 选择字幕文件（过滤 .srt/.ass）
    - 通过 `convertFileSrc` 将路径转为WebView可访问URL
  - 实现播放控制状态机：`idle → playing ↔ paused → ended`
  - 暴露播放器 ref API：`play()`, `pause()`, `seek(time)`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setVolume(vol)`
  - 实现时间同步hook `useVideoSync`：每帧同步 currentTime 到字幕索引
  - 实现文件导入状态管理：`video File | null`, `subtitle File | null`, `subtitleCues: SubtitleCue[]`
  - 导入字幕时自动检测格式（SRT/ASS），调用Task 4的parser
  - TDD：先写播放器状态机测试和导入流程测试

  **Must NOT do**:
  - 不实现字幕渲染（Task 7）
  - 不实现快捷键（Task 8）
  - 不实现A-B循环（Task 10）
  - 不处理在线视频URL

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React状态管理和效果hook最佳实践

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1, 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 7, 10, 14
  - **Blocked By**: Tasks 1, 5

  **References**:

  **Pattern References**:
  - Task 5 的 `convertFileSrc` 验证结果 — 确认了本地MP4播放方案
  - Task 4 的 `parseSubtitle()` 函数 — 字幕解析接口

  **API/Type References**:
  - `tauri-plugin-dialog`: `open({ filters: [{ name: "Video", extensions: ["mp4", "webm", "mkv"] }] })`
  - HTML5 Video API: `HTMLVideoElement.play()`, `.pause()`, `.currentTime`, `.playbackRate`, `timeupdate` event

  **WHY Each Reference Matters**:
  - `convertFileSrc` 是本地视频播放的核心桥梁
  - `timeupdate` 事件频率直接影响字幕同步精度

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/VideoPlayer.test.tsx`, `src/hooks/__tests__/useVideoSync.test.ts`
  - [ ] `pnpm vitest run src/components/VideoPlayer src/hooks/useVideoSync` → PASS

  **QA Scenarios:**

  ```
  Scenario: Import and play MP4 file
    Tool: Playwright
    Preconditions: Tauri dev running, test MP4 file available
    Steps:
      1. Click "Import Video" button
      2. Select test MP4 file from dialog
      3. Assert video element exists and has src attribute
      4. Click play button
      5. Wait 2 seconds
      6. Assert video is playing (currentTime > 0)
    Expected Result: Video loads and plays, currentTime advances
    Failure Indicators: Video element missing src, or currentTime stays at 0
    Evidence: .sisyphus/evidence/task-6-import-play.mp4

  Scenario: Import and parse SRT subtitle
    Tool: Playwright
    Preconditions: Video loaded, test SRT file available
    Steps:
      1. Click "Import Subtitle" button
      2. Select test SRT file
      3. Assert subtitle count is > 0
      4. Assert first subtitle cue has valid startTime, endTime, and text
    Expected Result: Subtitle cues array populated correctly
    Failure Indicators: Empty array, or invalid timestamps
    Evidence: .sisyphus/evidence/task-6-import-srt.txt
  ```

  **Commit**: YES (Wave 2 group)

- [ ] 7. 字幕同步渲染 + 4种显示模式

  **What to do**:
  - 创建 `src/components/SubtitleRenderer.tsx`：字幕渲染组件
  - 实现4种显示模式：
    - `word-segmented`: 英文单词逐词高亮，当前词突出显示
    - `word-segmented-translation`: 上行分词英文，下行整句翻译
    - `plain`: 普通字幕（纯英文文本）
    - `plain-translation`: 英文上行+翻译下行
  - 实现字幕同步逻辑：根据 `currentTime` 从 `subtitleCues` 中找到当前活跃字幕
  - 实现下一句预加载：提前1秒加载下一句的时间范围
  - 实现字幕切换过渡动画（fade in/out, 200ms）
  - 处理字幕间隙：当前句结束到下一句开始之间不显示字幕
  - TDD：先写时间同步算法测试、分词渲染测试、模式切换测试

  **Must NOT do**:
  - 不实现分词算法（那是Task 9，此处调用其接口）
  - 不实现点击字幕分析（Task 12）
  - 不实现双语字幕合并逻辑（当前MVP只支持英文字幕，翻译来自LLM）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React渲染性能和列表虚拟化

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 4, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Tasks 4, 6

  **References**:

  **Pattern References**:
  - Task 4 的 `SubtitleCue` 类型定义和 `parseSubtitle()` 函数
  - Task 9 的 `segmentWords(text: string): WordSegment[]` 接口（分词模块）

  **API/Type References**:
  - `SubtitleCue`: `{ id, startTime, endTime, text, originalText }`
  - `WordSegment`: `{ word: string, isKeyWord: boolean, startIndex: number, endIndex: number }`（Task 9定义）

  **WHY Each Reference Matters**:
  - 字幕渲染是用户最常看到的界面，4种模式是核心差异化功能
  - 分词接口需要在Task 9之前占位（先用简单空格分割，Task 9完成后替换）

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/SubtitleRenderer.test.tsx`
  - [ ] `pnpm vitest run src/components/SubtitleRenderer` → PASS
  - [ ] 覆盖: 4种模式渲染、时间同步、间隙处理、过渡动画

  **QA Scenarios:**

  ```
  Scenario: All 4 subtitle modes render correctly
    Tool: Playwright
    Preconditions: Video + subtitle loaded, playing
    Steps:
      1. Set display mode to 'word-segmented'
      2. Verify each word is a separate span with highlight class
      3. Switch to 'word-segmented-translation'
      4. Verify two lines rendered (English + Chinese translation)
      5. Switch to 'plain'
      6. Verify single line of English text
      7. Switch to 'plain-translation'
      8. Verify two lines (English + translation)
    Expected Result: Each mode renders correctly with proper structure
    Failure Indicators: Missing spans, wrong layout, or mode switch doesn't update
    Evidence: .sisyphus/evidence/task-7-subtitle-modes.mp4

  Scenario: Subtitle syncs with video timeupdate
    Tool: Playwright
    Preconditions: Video playing at 30s, subtitle at 30-35s exists
    Steps:
      1. Seek video to 30.5s
      2. Assert subtitle text matches the cue spanning 30-35s
      3. Seek to 36s (between cues)
      4. Assert no subtitle displayed
    Expected Result: Subtitle changes at correct time boundaries
    Failure Indicators: Wrong subtitle shown, or subtitle displayed during gap
    Evidence: .sisyphus/evidence/task-7-subtitle-sync.txt
  ```

  **Commit**: YES (Wave 2 group)

- [ ] 8. 键盘快捷键系统

  **What to do**:
  - 创建 `src/hooks/useKeyboardShortcuts.ts`：全局快捷键管理hook
  - 使用 `tauri-plugin-global-shortcut` 注册桌面全局快捷键
  - 定义快捷键映射（可在设置中自定义）：
    - `Space`: 播放/暂停
    - `ArrowLeft`: 快退5秒
    - `ArrowRight`: 快进5秒
    - `ArrowUp`: 上一句字幕
    - `ArrowDown`: 下一句字幕
    - `1`: 设置A点（A-B循环起始）
    - `2`: 设置B点（A-B循环结束）
    - `3`: 开始/停止A-B循环
    - `4`: 清除A-B循环
    - `[`: 减速播放（0.5x → 0.75x → 1.0x → 1.25x → 1.5x）
    - `]`: 加速播放
    - `Escape`: 关闭分析卡片/退出隐蔽模式
  - 实现快捷键冲突处理：当输入框聚焦时不触发快捷键
  - 实现快捷键状态反馈：OSD（屏幕显示）反馈当前操作（如"Speed: 0.75x"）
  - TDD：先写快捷键映射测试、冲突处理测试

  **Must NOT do**:
  - 不实现A-B循环逻辑（Task 10）
  - 不实现播放速度切换逻辑（Task 10）
  - 不注册移动端快捷键（global-shortcut不支持移动端）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7, 9 in Wave 2, after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 10, 12, 15
  - **Blocked By**: Task 1

  **References**:

  **API/Type References**:
  - `tauri-plugin-global-shortcut`: `register(shortcut, handler)`, `unregister(shortcut)`, `unregisterAll()`

  **External References**:
  - tauri-plugin-global-shortcut文档: `https://v2.tauri.app/plugin/global-shortcut/`

  **WHY Each Reference Matters**:
  - 键盘快捷键是100LS学习体验的核心，必须在桌面端全局可用

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/hooks/__tests__/useKeyboardShortcuts.test.ts`
  - [ ] `pnpm vitest run src/hooks/useKeyboardShortcuts` → PASS

  **QA Scenarios:**

  ```
  Scenario: All keyboard shortcuts respond correctly
    Tool: Playwright + interactive_bash
    Preconditions: App running, video loaded and playing
    Steps:
      1. Press Space → verify video pauses
      2. Press Space again → verify video resumes
      3. Press ArrowRight → verify currentTime advances ~5s
      4. Press ArrowLeft → verify currentTime goes back ~5s
      5. Press ] → verify playbackRate increases
      6. Press [ → verify playbackRate decreases
      7. Press ArrowDown → verify next subtitle cue shown
      8. Press ArrowUp → verify previous subtitle cue shown
    Expected Result: Each shortcut triggers correct behavior
    Failure Indicators: Shortcut not responding, or wrong action triggered
    Evidence: .sisyphus/evidence/task-8-shortcuts.txt

  Scenario: Shortcuts ignored when input is focused
    Tool: Playwright
    Preconditions: App running, search input focused
    Steps:
      1. Click into settings search input
      2. Press Space → verify it types space character, does NOT pause video
    Expected Result: Space types in input, video keeps playing
    Failure Indicators: Video pauses when typing in input
    Evidence: .sisyphus/evidence/task-8-input-conflict.txt
  ```

  **Commit**: YES (Wave 2 group)

- [ ] 9. 英文分词模块

  **What to do**:
  - 创建 `src/lib/subtitle/segmenter.ts`：英文分词模块
  - 优先使用 `Intl.Segmenter`（现代浏览器和Tauri WebView2支持）
  - 实现 `segmentWords(text: string): WordSegment[]` 接口：
    ```typescript
    interface WordSegment {
      word: string;
      isPunctuation: boolean;
      startIndex: number;
      endIndex: number;
    }
    ```
  - 处理缩写词：`don't`, `I'm`, `can't` 等视为一个词
  - 处理标点符号：逗号、句号、感叹号等单独标记
  - 实现 fallback：如果 `Intl.Segmenter` 不可用，使用简单空格分割
  - TDD：测试各种英文文本的分词结果（缩写、标点、数字、混合大小写）

  **Must NOT do**:
  - 不用regex做分词（容易出错的正则如 `\b\w+\b` 无法处理缩写和标点）
  - 不引入NLP库（太重，小的分词器足够）
  - 不做中文分词（MVP只做英文）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7, 8 in Wave 2, after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 11
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - `Intl.Segmenter` MDN文档: `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter`
  - Tauri WebView2 支持: `Intl.Segmenter` 在 Chromium 87+ 可用

  **WHY Each Reference Matters**:
  - `Intl.Segmenter` 是浏览器原生分词API，性能好且正确处理缩写和标点
  - WebView2基于Chromium，确认支持是使用前提

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/lib/subtitle/__tests__/segmenter.test.ts`
  - [ ] `pnpm vitest run src/lib/subtitle/segmenter` → PASS
  - [ ] 覆盖: 基本分词, 缩写词(don't/I'm/can't), 标点分离, 数字, 空字符串, 回退机制

  **QA Scenarios:**

  ```
  Scenario: Segment English text with abbreviations
    Tool: Bash
    Preconditions: Segmenter module with tests
    Steps:
      1. Run `pnpm vitest run src/lib/subtitle/__tests__/segmenter.test.ts`
      2. Check "don't" is segmented as ONE word, not "don" + "'t"
      3. Check "I'm" is segmented as ONE word
      4. Check "Hello, world!" has punctuation separated
    Expected Result: Abbreviations stay together, punctuation separated
    Failure Indicators: "don't" split into 2 words, punctuation attached to words
    Evidence: .sisyphus/evidence/task-9-segmenter.txt

  Scenario: Fallback when Intl.Segmenter unavailable
    Tool: Bash
    Preconditions: Test that explicitly unsets Intl.Segmenter
    Steps:
      1. Run test with Intl.Segmenter mocked as undefined
      2. Verify fallback to space-split produces reasonable results
    Expected Result: Fallback produces word segmentation (less accurate but functional)
    Failure Indicators: Function throws error instead of falling back
    Evidence: .sisyphus/evidence/task-9-segmenter-fallback.txt
  ```

  **Commit**: YES (Wave 2 group)

- [ ] 10. A-B循环 + 播放速度控制

  **What to do**:
  - 创建 `src/hooks/useABLoop.ts`：A-B循环状态管理hook
  - 实现 A-B 循环状态机：`idle → a_set → ab_set → looping → idle`
    - 按 `1` 设置A点：记录 `currentTime`，对齐到最近字幕的开始时间
    - 按 `2` 设置B点：记录 `currentTime`，对齐到最近字幕的结束时间
    - 按 `3` 开始/停止循环
    - 按 `4` 清除循环
  - 实现循环检测：使用 `requestAnimationFrame` + `timeupdate` 双重检测
    - `timeupdate` 为主检测（约4Hz）
    - `requestAnimationFrame` 为辅助检测（60Hz），仅在循环激活时启用
    - 防抖：循环跳转后 200ms cooldown 期内不再次检测
  - 循环跳转使用 margin 容忍度：`startMargin=0.3s`, `endMargin=0.5s`
  - 处理边缘情况：
    - A点大于B点：忽略，提示用户重新设置
    - 视频ended事件：停止循环（ended优先级高于循环）
    - 变速播放（0.5x）：rAF检测确保不到过B点
  - 创建 `src/hooks/usePlaybackRate.ts`：播放速度控制
    - 5档：0.5x / 0.75x / 1.0x / 1.25x / 1.5x
    - 快捷键 `[` 减速，`]` 加速
    - OSD反馈当前速度
  - TDD：先写状态机测试、循环检测测试、变速播放测试

  **Must NOT do**:
  - 不追求帧级精度（句子级3-8秒片段精度可接受）
  - 不实现基于波形可视化的循环点选择

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7, 8, 9, 11 in Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 6, 8

  **References**:

  **Pattern References**:
  - Task 6 的播放器 ref API：`getCurrentTime()`, `seek()`, `setPlaybackRate()`
  - Task 8 的快捷键系统：数字键1-4和方括号键
  - `videojs-abloop` 的 isLooping 防抖模式参考

  **API/Type References**:
  - `HTMLVideoElement.currentTime`: 当前播放位置（秒）
  - `HTMLVideoElement.playbackRate`: 播放速率
  - `requestAnimationFrame`: 高频帧检测

  **WHY Each Reference Matters**:
  - A-B循环是100LS方法的核心功能，实现正确性直接影响学习体验
  - rAF+timeupdate双重检测是避免循环跳转失败的关键模式

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/hooks/__tests__/useABLoop.test.ts`, `src/hooks/__tests__/usePlaybackRate.test.ts`
  - [ ] `pnpm vitest run src/hooks/useABLoop src/hooks/usePlaybackRate` → PASS

  **QA Scenarios:**

  ```
  Scenario: A-B loop works at normal speed
    Tool: Playwright
    Preconditions: Video playing, subtitle at 10-15s
    Steps:
      1. Seek to 10s, press "1" (set A point)
      2. Seek to 15s, press "2" (set B point)
      3. Press "3" (start loop)
      4. Wait for video to reach 15s + margin
      5. Assert video jumps back to ~10s
      6. Wait again, assert second loop occurs
      7. Press "3" (stop loop)
      8. Assert video continues past 15s
    Expected Result: Video loops between A and B points, stops looping when told
    Failure Indicators: Video doesn't jump back, or jumps to wrong position
    Evidence: .sisyphus/evidence/task-10-ab-loop.mp4

  Scenario: Playback speed control
    Tool: Playwright
    Preconditions: Video playing at 1.0x
    Steps:
      1. Press "]" → assert speed becomes 1.25x
      2. Press "]" → assert speed becomes 1.5x
      3. Press "[" → assert speed becomes 1.25x
      4. Press "[" 3 times → assert speed becomes 0.5x
      5. Verify OSD shows current speed
    Expected Result: Speed changes through 5 presets, OSD updates
    Failure Indicators: Speed doesn't change, or jumps to wrong value
    Evidence: .sisyphus/evidence/task-10-playback-rate.txt

  Scenario: A-B loop at 0.5x speed doesn't miss B point
    Tool: Playwright
    Preconditions: A-B loop set between 10-15s, playback at 0.5x
    Steps:
      1. Set playback rate to 0.5x
      2. Activate A-B loop
      3. Wait for video to pass B point
      4. Verify video jumps back within 1 second
    Expected Result: Loop works at slow speed without missing B point
    Failure Indicators: Video continues past B point at slow speed
    Evidence: .sisyphus/evidence/task-10-ab-loop-slow.mp4
  ```

  **Commit**: YES (Wave 2 group)

- [ ] 11. LLM 分析卡片 UI

  **What to do**:
  - 创建 `src/components/AnalysisCard.tsx`：LLM分析结果展示组件
  - 渲染LLM返回的JSON结构：
    - 整句翻译（醒目展示）
    - 语境用法列表：每个用法有 example sentence + explanation
    - 语法点列表：每个语法点有 point + explanation
    - 词汇列表：每个词有 word + definition + pronunciation
  - 暗色磨砂风格：
    - 背景: `rgba(20, 20, 30, 0.85)` + `backdrop-filter: blur(20px)`
    - 圆角: 16px
    - 卡片阴影: `0 8px 32px rgba(0, 0, 0, 0.3)`
  - 全屏覆盖视频区域（暂停视频时展示）
  - 加载状态：骨架屏 + spinner动画
  - 错误状态：友好的错误提示 + 重试按钮
  - 空状态：当LLM返回空内容时的提示
  - ESC键关闭分析卡片
  - TDD：先写渲染测试（mock数据）、错误状态测试

  **Must NOT do**:
  - 不实现LLM请求逻辑（Task 12）
  - 不实现流式渲染（MVP用单次JSON）
  - 不在隐蔽模式下特殊处理全屏（Task 13处理）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 暗色磨砂UI设计和卡片组件布局

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7, 8, 9, 10 in Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 9

  **References**:

  **API/Type References**:
  - LLM 响应类型（Task 3定义）：
    ```typescript
    interface LLMResponse {
      translation: string;
      usage_context: { example: string; explanation: string }[];
      grammar_notes: { point: string; explanation: string }[];
      vocabulary: { word: string; definition: string; pronunciation: string }[];
    }
    ```
  - `WordSegment` 类型（Task 9定义）：分词结果中的单词信息

  **WHY Each Reference Matters**:
  - 分析卡片是用户学习交互的核心UI，必须正确渲染所有LLM字段
  - 暗色磨砂风格是产品差异化视觉标识

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/AnalysisCard.test.tsx`
  - [ ] `pnpm vitest run src/components/AnalysisCard` → PASS
  - [ ] 覆盖: 正常数据渲染, 加载骨架屏, 错误+重试, 空状态, ESC关闭

  **QA Scenarios:**

  ```
  Scenario: Analysis card renders all LLM response fields
    Tool: Playwright
    Preconditions: App running, mock LLM response injected
    Steps:
      1. Trigger subtitle click that loads mock LLM response
      2. Assert translation text is visible and prominent
      3. Assert usage_context items are listed with examples and explanations
      4. Assert grammar_notes items are listed
      5. Assert vocabulary items show word, definition, pronunciation
    Expected Result: All sections rendered with correct data
    Failure Indicators: Missing sections, or data not matching mock
    Evidence: .sisyphus/evidence/task-11-analysis-card.png

  Scenario: Analysis card shows error state with retry
    Tool: Playwright
    Preconditions: App running, mock LLM returns 500 error
    Steps:
      1. Trigger subtitle click that triggers LLM request
      2. Assert error message is displayed
      3. Assert retry button is visible
      4. Click retry button
      5. Assert loading state shows, then either success or error
    Expected Result: Error shown, retry triggers new request
    Failure Indicators: No error shown on failure, or retry button missing
    Evidence: .sisyphus/evidence/task-11-error-state.png

  Scenario: ESC key closes analysis card
    Tool: Playwright
    Preconditions: Analysis card is open
    Steps:
      1. Press Escape key
      2. Assert analysis card is hidden
      3. Assert video is still paused (or resumed per settings)
    Expected Result: Card closes, appropriate video state maintained
    Failure Indicators: Card remains visible after ESC
    Evidence: .sisyphus/evidence/task-11-esc-close.txt
  ```

  **Commit**: YES (Wave 2 group)

## Commit Strategy

- **Wave 1 End**: `feat(core): project scaffold, schema, LLM proxy, subtitle parser, video validation` - src-tauri/, src/
- **Wave 2 End**: `feat(player): video player, subtitle modes, shortcuts, A-B loop, segmentation, analysis card` - src/components/, src-tauri/src/
- **Wave 3 End**: `feat(interaction): click-to-analyze flow, stealth mode, progress tracking, settings` - src/components/, src/hooks/
- **Wave 4 End**: `feat(polish): dark theme, E2E integration, edge cases` - src/theme/, src/
- **Final**: `feat(all): JoJo Listen MVP complete` - all files

---

## Success Criteria

### Verification Commands
```bash
pnpm vitest run                    # Expected: All tests pass
cargo test --manifest-path src-tauri/Cargo.toml  # Expected: All Rust tests pass
pnpm tsc --noEmit                  # Expected: No type errors
pnpm tauri build                   # Expected: Build succeeds, produces installer
```

- [ ] 12. 字幕点击 → LLM 分析请求流

  **What to do**:
  - 创建 `src/hooks/useSubtitleAnalysis.ts`：连接字幕点击和LLM请求的完整流程
  - 实现点击事件处理：
    - 用户点击字幕中的词或句子 → 暂停视频
    - 构建LLM请求：当前句子 + 上下文（前后各2句字幕）
    - 通过 `invoke('analyze_sentence', { sentence, context })` 调用Rust后端
    - 收到响应后显示分析卡片（Task 11的组件）
  - 实现LLM缓存：查询 `llm_cache` 表，命中则直接返回
  - 实现请求去重：同一句子的并发请求只发送一次
  - 实现加载/错误/成功状态转换
  - TDD：先写点击处理测试、缓存查询测试、请求去重测试

  **Must NOT do**:
  - 不在前端直接调用HTTP请求（必须通过Rust invoke）
  - 不实现流式响应
  - 不做字幕选中高亮（后续优化）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React状态管理和副作用处理

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 7, 8, 11

  **References**:

  **Pattern References**:
  - Task 3 的 `analyze_sentence` Tauri命令 — Rust后端LLM代理
  - Task 7 的 `SubtitleRenderer` 组件 — 字幕点击事件源
  - Task 8 的快捷键系统 — ESC关闭分析卡片
  - Task 11 的 `AnalysisCard` 组件 — 分析结果展示
  - Task 2 的 `llm_cache` 表 — 缓存查询

  **API/Type References**:
  - Tauri `invoke()`: `invoke<LLMResponse>('analyze_sentence', { sentence: string, context: string[] })`
  - `LLMResponse` 类型（Task 3定义）

  **WHY Each Reference Matters**:
  - 这是连接字幕UI和LLM后端的核心数据流，需要正确编排暂停、请求、缓存、展示

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/hooks/__tests__/useSubtitleAnalysis.test.ts`
  - [ ] `pnpm vitest run src/hooks/useSubtitleAnalysis` → PASS

  **QA Scenarios:**

  ```
  Scenario: Click subtitle word triggers LLM analysis and displays results
    Tool: Playwright
    Preconditions: Video playing, subtitles visible, LLM API configured and reachable
    Steps:
      1. Click on a word in the current subtitle
      2. Assert video pauses
      3. Assert loading skeleton appears
      4. Wait for LLM response (max 10s)
      5. Assert analysis card shows translation, usage context, grammar notes, vocabulary
    Expected Result: Full analysis card displayed with all LLM response fields
    Failure Indicators: Card stays in loading state, or shows error
    Evidence: .sisyphus/evidence/task-12-click-analyze.png

  Scenario: LLM cache serves repeated requests
    Tool: Bash
    Preconditions: Video paused, same sentence analyzed twice
    Steps:
      1. Click subtitle word → wait for LLM response
      2. Close analysis card
      3. Click same subtitle word again
      4. Assert analysis card appears instantly (no loading skeleton)
    Expected Result: Second analysis shows immediately from cache
    Failure Indicators: Second request shows loading skeleton (cache miss)
    Evidence: .sisyphus/evidence/task-12-cache-hit.txt

  Scenario: LLM timeout shows error with retry
    Tool: Playwright
    Preconditions: LLM API configured but server unreachable (timeout scenario)
    Steps:
      1. Click subtitle word
      2. Wait for timeout (30s)
      3. Assert error message displayed with retry button
      4. Click retry button
      5. Assert loading state shown again
    Expected Result: Error displayed, retry button functional
    Failure Indicators: Infinite loading, or no error message
    Evidence: .sisyphus/evidence/task-12-timeout-error.png
  ```

  **Commit**: YES (Wave 3 group)

- [ ] 13. 隐蔽双模式 UI

  **What to do**:
  - 创建 `src/components/StealthMode.tsx`：隐蔽模式切换组件
  - 实现三种模式切换：
    - **正常模式**: 完整播放器 + 字幕 + 控制栏
    - **迷你模式**: 小窗口（480x320）+ 字幕覆盖 + 简化控制栏
    - **字幕条模式**: 纯字幕条（800x100）+ 点击穿透可选
  - 实现模式间的平滑过渡动画（resize + fade, 300ms）
  - 实现窗口管理：
    - 正常 → 迷你：`window.setSize(480, 320)`
    - 迷你 → 字幕条：`window.setSize(800, 100)`
    - `alwaysOnTop` 在非正常模式下启用
    - 无边框窗口 (`decorations: false`) + 自定义拖拽区域
  - 字幕条模式的点击事件：点击字幕 → 暂停 + 显示分析卡片（此时自动展开为迷你模式）
  - 键盘快捷键 `S` 切换隐蔽模式循环：正常 → 迷你 → 字幕条 → 正常
  - 键盘快捷键 `T` 切换点击穿透（仅字幕条模式）
  - 注意处理 `setIgnoreCursorEvents` 的Tauri bug #11052：使用无边框窗口绕过，不依赖此API设置点击穿透
  - TDD：先写模式切换测试、窗口尺寸变化测试

  **Must NOT do**:
  - 不创建多个Tauri窗口（用CSS切换模式）
  - 不实现移动端小窗（MVP只做桌面端）
  - 不在字幕条模式下使用 `setIgnoreCursorEvents(true)` （已知bug，改用其他方案）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 窗口动画和最小化UI设计

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12, 14, 15 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 6, 7

  **References**:

  **Pattern References**:
  - Task 6 的播放器组件 — 模式切换目标
  - Task 7 的字幕渲染 — 各模式下的字幕布局
  - lx-music-desktop 的歌词窗: `setAlwaysOnTop(true, 'screen-saver')` + 透明度调节
  - Snipaste 的贴图模式：点击穿透 + 窗口置顶

  **API/Type References**:
  - Tauri Window API: `setSize()`, `setAlwaysOnTop()`, `setDecorations()`
  - CSS `backdrop-filter: blur()` 用于磨砂效果
  - 注意避开 `setIgnoreCursorEvents()` (bug #11052)

  **WHY Each Reference Matters**:
  - 隐蔽模式是上班使用场景的核心，必须在不触发已知bug的前提下实现

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/StealthMode.test.tsx`
  - [ ] `pnpm vitest run src/components/StealthMode` → PASS

  **QA Scenarios:**

  ```
  Scenario: Switch between 3 display modes
    Tool: Playwright
    Preconditions: App running in normal mode with video loaded
    Steps:
      1. Press "S" → assert window transitions to mini mode (480x320)
      2. Press "S" → assert window transitions to subtitle bar mode (800x100)
      3. Press "S" → assert window transitions back to normal mode
      4. Verify each mode shows correct layout (full player / mini player / subtitle bar only)
    Expected Result: Smooth transitions between modes with correct layouts
    Failure Indicators: Window doesn't resize, layout broken in any mode
    Evidence: .sisyphus/evidence/task-13-mode-switch.mp4

  Scenario: Subtitle bar mode - click subtitle to analyze
    Tool: Playwright
    Preconditions: App in subtitle bar mode
    Steps:
      1. Click on subtitle text
      2. Assert video pauses
      3. Assert mode switches from subtitle bar to mini mode (to show analysis card)
      4. Press ESC to close analysis
    Expected Result: Clicking subtitle in bar mode pauses video and expands to show analysis
    Failure Indicators: Analysis card doesn't show, or video doesn't pause
    Evidence: .sisyphus/evidence/task-13-bar-click.png

  Scenario: Always-on-top in stealth modes
    Tool: Bash
    Preconditions: App in mini mode, another window open
    Steps:
      1. Switch to mini mode
      2. Click on another window (e.g., browser)
      3. Assert JoJo Listen window stays visible on top
    Expected Result: App stays above other windows in stealth modes
    Failure Indicators: App disappears behind other windows
    Evidence: .sisyphus/evidence/task-13-always-on-top.txt
  ```

  **Commit**: YES (Wave 3 group)

- [ ] 14. 学习进度持久化

  **What to do**:
  - 创建 `src/hooks/useProgress.ts`：进度状态管理hook
  - 实现自动保存：
    - `timeupdate` 时每5秒保存一次播放位置到 `watch_progress` 表
    - 视频结束或窗口关闭时保存最终位置
    - 进度保存使用 debounce（5秒间隔），避免频繁写入
  - 实现观看计数：每次打开视频（从 stopped 状态到 playing）计数+1
  - 实现进度恢复：打开视频时从上次停止位置继续
  - 实现视频列表管理：
    - 首页显示所有已导入的视频列表
    - 显示每个视频的：缩略图（首帧）、文件名、观看次数、最后观看日期、进度百分比
    - 点击视频项恢复到上次位置继续播放
  - 实现A-B循环持久化：保存用户的A-B循环点到 `ab_loops` 表
  - TDD：先写进度保存/恢复测试、计数测试、列表管理测试

  **Must NOT do**:
  - 不实现云同步
  - 不实现SRS/间隔重复
  - 不自动生成视频缩略图（后续版本考虑，MVP用默认占位图）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12, 13, 15 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 2, 6

  **References**:

  **API/Type References**:
  - Task 2 的 `videos` 表: `id, file_path, file_name, duration, created_at, last_watched_at, watch_count`
  - Task 2 的 `watch_progress` 表: `id, video_id, position_seconds, playback_rate, last_position`
  - Task 2 的 `ab_loops` 表: `id, video_id, start_time, end_time, label, created_at`

  **WHY Each Reference Matters**:
  - 进度持久化是100LS学习的核心记录功能，确保用户每次打开视频从正确位置继续

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/hooks/__tests__/useProgress.test.ts`
  - [ ] `pnpm vitest run src/hooks/useProgress` → PASS

  **QA Scenarios:**

  ```
  Scenario: Progress saves on timeupdate interval
    Tool: Bash
    Preconditions: Video playing at 45s position
    Steps:
      1. Start playing video at 0s
      2. Seek to 45s
      3. Wait 6 seconds (for debounce interval)
      4. Close and reopen app
      5. Verify video resumes at ~45s (±2s tolerance)
    Expected Result: Video resumes at approximately the saved position
    Failure Indicators: Video starts from 0s after reopening
    Evidence: .sisyphus/evidence/task-14-progress-save.txt

  Scenario: Watch count increments on each video play
    Tool: Bash
    Preconditions: Video with 0 watch count
    Steps:
      1. Open and play video → count becomes 1
      2. Stop and play again → count becomes 2
      3. Close app, reopen, play again → count becomes 3
    Expected Result: Watch count accurately reflects play sessions
    Failure Indicators: Count doesn't increment or increments multiple times per play
    Evidence: .sisyphus/evidence/task-14-watch-count.txt

  Scenario: A-B loop points persist across sessions
    Tool: Bash
    Preconditions: A-B loop set at 10-15s on a video
    Steps:
      1. Set A-B loop points
      2. Close app
      3. Reopen app and load same video
      4. Verify A-B loop points still exist
    Expected Result: A-B loop points restored from database
    Failure Indicators: A-B loop points lost after restart
    Evidence: .sisyphus/evidence/task-14-ab-loop-persist.txt
  ```

  **Commit**: YES (Wave 3 group)

- [ ] 15. 设置面板（LLM配置、快捷键、显示模式）

  **What to do**:
  - 创建 `src/components/SettingsPanel.tsx`：设置面板组件
  - 实现设置分类：
    - **LLM配置**: API URL、Model名称、API Key（安全输入，用keychain存储）
    - **快捷键**: 显示所有快捷键映射，允许重新绑定
    - **显示**: 默认字幕模式、默认播放速度、OSD开关
  - 实现API连接测试：保存配置前发送测试请求验证API可用性
  - 实现API Key安全存储：使用 `tauri-plugin-keychain`
  - 实现设置导入/导出：JSON配置文件
  - 暗色磨砂UI设计，与整体风格一致
  - 打开/关闭：快捷键 `,`（逗号）或齿轮图标
  - TDD：先写设置CRUD测试、API连接测试

  **Must NOT do**:
  - 不实现快捷键重新绑定UI（MVP只显示快捷键列表，不允许修改）— 后续版本
  - 不实现云同步设置

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 设置面板UI设计

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12, 13, 14 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 3, 8

  **References**:

  **Pattern References**:
  - Task 3 的 `chat_with_retry` 和 API验证逻辑
  - Task 8 的快捷键映射配置
  - Task 2 的 `settings` 表结构

  **API/Type References**:
  - `tauri-plugin-keychain`: `Keychain.set("jojo-listen-api-key", value)`, `.get()`
  - `tauri-plugin-store`: 非敏感配置存储

  **WHY Each Reference Matters**:
  - API Key安全存储是基本安全要求，设置面板需要正确使用keychain

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/SettingsPanel.test.tsx`
  - [ ] `pnpm vitest run src/components/SettingsPanel` → PASS

  **QA Scenarios:**

  ```
  Scenario: Save and verify LLM configuration
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Open settings panel (press "," or click gear icon)
      2. Enter API URL: "https://api.openai.com/v1"
      3. Enter Model: "gpt-4o"
      4. Enter API Key (masked input)
      5. Click "Test Connection"
      6. Assert success or meaningful error message
      7. Click "Save"
      8. Close and reopen app
      9. Assert settings are persisted
    Expected Result: Settings save correctly and persist across restarts
    Failure Indicators: Settings lost after restart, or API key visible in plain text
    Evidence: .sisyphus/evidence/task-15-settings-save.txt

  Scenario: API Key stored in keychain (not in config file)
    Tool: Bash
    Preconditions: Settings saved with API key
    Steps:
      1. Search application config files for the API key string
      2. Assert API key NOT found in any JSON/config file
      3. Verify API key is retrievable via keychain API
    Expected Result: API key only in OS keychain, never in plaintext config
    Failure Indicators: API key found in configuration file content
    Evidence: .sisyphus/evidence/task-15-keychain-security.txt
  ```

  **Commit**: YES (Wave 3 group)

- [ ] 16. 暗色磨砂主题系统

  **What to do**:
  - 创建 `src/theme/` 目录：设计令牌 + CSS变量 + 主题Provider
  - 定义设计令牌：
    - 颜色：`--bg-primary: rgba(20, 20, 30, 0.85)`, `--bg-secondary: rgba(30, 30, 45, 0.9)`, `--text-primary: #e8e8f0`, `--accent: #6c63ff`
    - 圆角：`--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`
    - 阴影：`--shadow-card: 0 8px 32px rgba(0, 0, 0, 0.3)`
    - 模糊：`--blur-md: blur(20px)`, `--blur-lg: blur(40px)`
    - 字体：无衬线字体栈
  - 实现CSS变量系统：`data-theme="dark-frosted"` 应用于 `<html>`
  - 实现组件样式统一：按钮、输入框、卡片、工具提示全部使用CSS变量
  - 确保字幕在不同背景下的可读性：文字阴影、半透明背景
  - 实现动画令牌：过渡时间 `--duration-normal: 200ms`, `--duration-slow: 300ms`

  **Must NOT do**:
  - 不实现亮色主题（MVP只有暗色磨砂）
  - 不使用第三方UI库（如shadcn/ui）——保持最小依赖，完全自定义样式

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 暗色磨砂glassmorphism主题设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 17
  - **Blocked By**: Task 1

  **References**:

  **External References**:
  - Glassmorphism CSS: `backdrop-filter: blur()`, `background: rgba()`, `border: 1px solid rgba(255,255,255,0.1)`
  - macOS暗色磨砂风格参考：系统界面、Spotlight搜索栏

  **WHY Each Reference Matters**:
  - 暗色磨砂是产品核心视觉标识，上班使用时不显眼但有品质感

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Theme CSS variables applied correctly
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Assert <html> has data-theme="dark-frosted"
      2. Assert CSS variable --bg-primary equals "rgba(20, 20, 30, 0.85)"
      3. Assert --blur-md equals "blur(20px)"
    Expected Result: All theme variables defined and applied
    Failure Indicators: Missing CSS variables or wrong values
    Evidence: .sisyphus/evidence/task-16-theme-variables.txt

  Scenario: Subtitle text readable on video background
    Tool: Playwright
    Preconditions: Video playing, subtitle visible
    Steps:
      1. Take screenshot of video with subtitle
      2. Assert subtitle text has text-shadow or background overlay for readability
    Expected Result: Subtitle text clearly visible against any video frame
    Failure Indicators: Text blends into video background, hard to read
    Evidence: .sisyphus/evidence/task-16-subtitle-readability.png
  ```

  **Commit**: YES (Wave 4 group)

- [ ] 17. 端到端集成：导入 → 播放 → 分析 → 追踪

  **What to do**:
  - 创建 `src/App.tsx` 的完整页面布局，串联所有模块
  - 实现首页（视频列表）→ 播放页 → 分析的完整用户流程
  - 串接所有组件：
    - 首页：视频列表（Task 14）→ 点击视频 → 进入播放页
    - 播放页：VideoPlayer（Task 6）+ SubtitleRenderer（Task 7）+ KeyboardShortcuts（Task 8）+ ABLoop（Task 10）
    - 点击字幕 → useSubtitleAnalysis（Task 12）→ AnalysisCard（Task 11）
    - 模式切换 → StealthMode（Task 13）
    - 设置 → SettingsPanel（Task 15）
    - 主题 → ThemeProvider（Task 16）
  - 实现完整的错误边界（React ErrorBoundary）
  - 实现加载状态：视频加载、字幕解析、LLM请求各阶段
  - 实现路由：`/` 首页, `/player/:id` 播放页
  - TDD：集成测试验证完整用户流程

  **Must NOT do**:
  - 不实现新的功能模块，只做集成
  - 不修改各模块的内部实现（除非发现接口不匹配）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React应用架构和集成模式

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 12, 14

  **References**:

  **Pattern References**:
  - Tasks 6-15 的所有组件接口

  **WHY Each Reference Matters**:
  - 集成是将所有独立模块连接为可用产品的关键步骤

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Complete user flow: import → play → analyze → track
    Tool: Playwright
    Preconditions: Fresh app installation, no videos imported, LLM API configured
    Steps:
      1. Launch app → see empty video list
      2. Click "Import Video" → select test MP4 file
      3. Click "Import Subtitle" → select test SRT file
      4. Verify video appears in list with correct metadata
      5. Click video → player page loads
      6. Press Space → video plays, subtitles appear
      7. Press ArrowDown → next subtitle shown
      8. Click a subtitle word → analysis card appears
      9. Verify analysis shows translation and usage context
      10. Press ESC → analysis card closes
      11. Set A-B loop (press 1, press 2, press 3) → video loops
      12. Press 4 → loop cleared
      13. Press S → switch to mini mode
      14. Press S → switch to subtitle bar mode
      15. Press S → switch back to normal mode
      16. Close and reopen app → verify progress resumed
    Expected Result: Complete smooth flow without errors
    Failure Indicators: Any step fails, app crashes, or data lost
    Evidence: .sisyphus/evidence/task-17-e2e-flow.mp4
  ```

  **Commit**: YES (Wave 4 group)

- [ ] 18. 边缘情况处理 + Error Boundaries

  **What to do**:
  - 创建全局错误边界组件 `src/components/ErrorBoundary.tsx`
  - 处理以下边缘情况：
    - **空字幕文件**: 提示"未找到字幕数据"，不崩溃
    - **损坏的SRT/ASS文件**: 优雅降级，解析成功的部分，跳过失败的
    - **LLM API URL 配置错误**: 首次保存时测试连接，错误URL给出明确提示
    - **LLM请求超时**: 30秒超时后显示错误+重试按钮
    - **视频文件不存在**: 导入时验证文件存在，播放时检测文件是否被移动/删除
    - **视频播放结束但A-B循环仍激活**: `ended` 事件优先级高于循环，自动停止循环
    - **字幕文件含HTML标签**: 清理后显示纯文本（已在Task 4处理，此处验证）
    - **A-B循环A点 > B点**: 提示用户重新设置
    - **0.5x播放下A-B循环**: rAF检测确保不漏过B点（已在Task 10处理，此处验证）
    - **超大字幕文件**: 10000+行的SRT文件性能测试
  - 实现全局异常捕获：未处理的Promise rejection和console.error
  - 实现Toast通知系统：错误/警告/成功提示
  - TDD：边缘情况测试套件

  **Must NOT do**:
  - 不引入新的功能
  - 不改变已有模块的核心逻辑（只添加保护性代码）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Final verification
  - **Blocked By**: Tasks 6-15 (所有前置模块)

  **References**:

  **Pattern References**:
  - Task 4 的字幕解析错误处理
  - Task 3 的LLM重试逻辑
  - Task 10 的A-B循环边缘情况

  **WHY Each Reference Matters**:
  - 边缘情况处理是产品从"demo"到"可用"的关键差距

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 测试文件: `src/components/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/edge-cases.test.ts`
  - [ ] `pnpm vitest run` → ALL PASS

  **QA Scenarios:**

  ```
  Scenario: Corrupt SRT file shows graceful error
    Tool: Playwright
    Preconditions: App running, corrupt SRT file available
    Steps:
      1. Import video (valid MP4)
      2. Import corrupt SRT file (random binary data)
      3. Assert error toast: "字幕文件格式错误，请检查文件"
      4. Assert app does NOT crash
      5. Assert video still playable (just no subtitles)
    Expected Result: Graceful error message, app continues functioning
    Failure Indicators: App crashes, or video won't play
    Evidence: .sisyphus/evidence/task-18-corrupt-srt.png

  Scenario: LLM API unreachable shows retry
    Tool: Playwright
    Preconditions: LLM API URL configured but unreachable
    Steps:
      1. Click subtitle to trigger LLM analysis
      2. Wait for timeout (30s)
      3. Assert error message with retry button
      4. Click retry → assert loading state shown
    Expected Result: Error + retry mechanism works
    Failure Indicators: Infinite spinner, or crash
    Evidence: .sisyphus/evidence/task-18-llm-timeout.png

  Scenario: Video file deleted externally
    Tool: Playwright
    Preconditions: Video imported and in list, but video file deleted from disk
    Steps:
      1. Click video in list
      2. Assert error message: "视频文件不存在或已被移动"
      3. Assert app remains functional
    Expected Result: Clear error message, app doesn't crash
    Failure Indicators: App crashes or freezes
    Evidence: .sisyphus/evidence/task-18-video-deleted.png

  Scenario: Large SRT file (10000+ lines) performance
    Tool: Bash
    Preconditions: SRT file with 10000+ subtitle cues
    Steps:
      1. Import large SRT file
      2. Measure parse time
      3. Assert parse time < 2 seconds
      4. Assert subtitle display is smooth (no jank)
    Expected Result: Large file parsed quickly, playback smooth
    Failure Indicators: Parse time > 5 seconds, or UI freezes during playback
    Evidence: .sisyphus/evidence/task-18-large-srt.txt
  ```

  **Commit**: YES (Wave 4 group)

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (Vitest + Rust)
- [ ] Import video + subtitle works end-to-end
- [ ] All 4 subtitle modes render correctly
- [ ] All keyboard shortcuts respond
- [ ] A-B loop functions correctly
- [ ] LLM analysis displays translation + context usage
- [ ] Stealth mode switches between subtitle bar and mini player
- [ ] Progress persists across app restarts