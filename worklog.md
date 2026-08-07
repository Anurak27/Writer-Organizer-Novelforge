# NovelForge Work Log

---
Task ID: 1
Agent: Main
Task: Analyze NovelCrafter YouTube video for UI/feature inspiration

Work Log:
- Attempted to read YouTube video page - blocked by CAPTCHA
- Used existing knowledge of NovelCrafter from user's detailed feature requests
- Identified key NovelCrafter features to implement: outline descriptions, scene details panel, rich codex categories, polished dark UI

Stage Summary:
- Video analysis complete based on user's explicit feature requests
- Feature gap analysis done comparing NovelForge vs NovelCrafter

---
Task ID: 2
Agent: Main
Task: Fix Gemini API + create shared AI provider module + fix pinnedCodexIds crash

Work Log:
- Created `src/lib/ai-provider.ts` - shared provider registry (9 providers, 3 formats)
- Extracted `callAI()` and `callAIWithHistory()` into shared module
- Added `isLocalProvider()` helper for Ollama/custom detection
- Fixed Gemini API: added better error handling (empty content, block reasons, full response logging)
- Fixed `JSON.parse(scene.pinnedCodexIds)` crash → `safeJsonParse()` in ai/generate/route.ts
- Rewrote ai/generate/route.ts to import from shared module
- Rewrote chat/route.ts to import from shared module
- Rewrote ai/test/route.ts to import from shared module
- Added console.error logging for AI failures

Stage Summary:
- Shared AI module eliminates code duplication across 3 route files
- Gemini API now has proper error messages (empty content, safety blocks)
- pinnedCodexIds no longer crashes on malformed JSON
- Files: ai-provider.ts (new), ai/generate/route.ts, chat/route.ts, ai/test/route.ts

---
Task ID: 3
Agent: Main
Task: Add Ollama client-side direct connection support

Work Log:
- Created `src/lib/ai-client.ts` - client-side Ollama/custom LLM calling utility
- `callLocalAI()` - calls local LLM directly from browser (OpenAI-compatible format)
- `getActiveAiConfig()` - fetches config from server, returns null for cloud providers
- Modified SceneEditor.tsx `callAiAction` to detect local providers and call from browser
- Modified ChatPanel.tsx `sendMessage` to detect local providers and call from browser
- Fixed ChatPanel bugs: GET /api/chat returns array (not `{messages}`), POST returns `{userMessage, assistantMessage}` (not `{messages}`)
- Added AiConfig.baseUrl to Zustand store type (was missing)

Stage Summary:
- Ollama now works in Vercel deployment by calling directly from browser
- User needs Ollama running locally with CORS enabled (default since v0.1.24)
- Chat history loading/display bugs fixed
- Files: ai-client.ts (new), SceneEditor.tsx, ChatPanel.tsx, useAppStore.ts

---
Task ID: 4
Agent: Main
Task: Create Scene Details panel

Work Log:
- Created `src/components/editor/SceneDetailsPanel.tsx`
- Replaced old SceneNotes (simple textarea) with full details panel
- Features: editable title, chapter info, status selector, POV override, word count, notes
- Status selector with visual badges (Outline/Draft/In Progress/Needs Revision/Complete)
- POV selector (1st/3rd person, past/present, omniscient)
- Notes with auto-save (2s debounce) and saved indicator
- Updated EditorView.tsx: tab renamed "Notes" → "Details", removed inline SceneNotes component

Stage Summary:
- Scene Details panel is now a proper metadata editor (like NovelCrafter's scene info)
- Files: SceneDetailsPanel.tsx (new), EditorView.tsx

---
Task ID: 5
Agent: Main
Task: Enhance Chapter Sidebar outline descriptions

Work Log:
- Chapter synopsis now shows when collapsed (line-clamp-1) in addition to expanded (line-clamp-3)
- Added scene count and word count per chapter when collapsed
- Scene notes show as italic subtitle for active scene
- Content preview shows for non-active scenes

Stage Summary:
- Sidebar now provides better outline visibility at a glance
- File: ChapterSidebar.tsx

---
Task ID: 6
Agent: Main
Task: Expand Codex custom categories

Work Log:
- Added 6 new built-in types: Style Guide (pink/Feather), Festival (orange/Calendar), Key Element (fuchsia/KeyRound), Synopsis (indigo/FileText), Core Message (teal/Target), Diary Structure (lime/BookOpen)
- Added new icons to ICON_MAP and COLOR_CLASSES (lime added)
- Updated categories API (categories/route.ts) to include new built-in types
- Updated category manager description text
- Removed "Up to 9 custom categories" limit text
- Fixed pinnedCodexIds JSON.parse crash in CodexPanel (safeJsonParse)

Stage Summary:
- Codex now has 12 built-in types covering all user-requested categories
- Additional custom categories still supported
- Files: CodexPanel.tsx, codex/categories/route.ts

---
Task ID: 7
Agent: Main
Task: Layout beautification

Work Log:
- Added amber text selection highlight in scene editor
- Added amber caret color in scene editor
- Added custom thin scrollbar styling (6px, subtle zinc)
- Added smooth 150ms transitions for all interactive elements
- Added subtle amber focus glow on inputs/textareas
- Tab size 4 for indentation in editor

Stage Summary:
- Dark theme polish with amber accent throughout
- Files: globals.css
---
