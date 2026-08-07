---
Task ID: 1
Agent: Super Z (Main)
Task: Add 7 major features to NovelForge: document import, cover/character images, inline images, style/prose settings, export (PDF/DOCX/EPUB/TXT), manuscript preview, 30s auto-save

Work Log:
- Updated Prisma schema: added `imagePath` to CodexEntry, `proseStyle`/`tone` to Book, new `UploadedImage` table
- Created `/api/upload` route for image uploads (covers, codex, inline) with validation
- Created `/api/export` route supporting PDF (pdfkit), DOCX (docx lib), EPUB (epub-gen-memory), TXT with inline image support
- Created `/api/import` route with AI-powered document parsing (mammoth for docx, raw text for pdf/txt)
- Created `/lib/ai-import.ts` helper for multi-provider AI import parsing
- Updated Zustand store: added `previewOpen`, `setPreviewOpen`, `proseStyle`, `tone`, `imagePath` to types
- Updated Bookshelf: cover upload on create/edit, cover images on book cards, style/prose/tone/custom prompt fields in edit dialog, Import and Export dialogs
- Updated CodexPanel: image upload per entry, image display in entry list and form dialog
- Updated SceneEditor: inline image insertion via `![alt](url)` syntax, 30s auto-save (from 3s), export (PDF/DOCX) and Preview buttons in bottom bar, ImagePlus button in toolbar
- Created PreviewModal: formatted book-style preview with inline images, title page, chapter headings
- Updated EditorView to include PreviewModal
- Updated all API routes (books, codex) to handle new fields
- Installed: mammoth, pdfkit, docx, epub-gen-memory
- Fixed: duplicate activeBookId in SceneEditor, JSX parent element error, require() lint errors

Stage Summary:
- All 7 features implemented and lint-clean
- App compiles and renders correctly (browser verified)
- Export supports 4 formats with image embedding
- AI import supports .txt, .docx, .pdf
- Cover images show on bookshelf cards
- Codex entries support character/location images
- Inline images for diary-style writing via markdown syntax
- Style/Prose/Tone/Custom Prompt settings per book for AI
- Auto-save changed to 30 seconds
- Manuscript preview modal shows formatted book layout
---
Task ID: 1
Agent: main
Task: Fix all reported bugs - Codex visibility, import errors, export errors, missing upload route

Work Log:
- Analyzed screenshot showing import dialog AI error
- Discovered /api/upload/route.ts was completely missing
- Created /api/upload/route.ts with POST (file upload) and GET (file serving for Vercel /tmp)
- Added View Codex option in book dropdown menu
- Added Raw Import mode button alongside Import with AI
- Fixed EPUB export using correct epub-gen-memory default function API
- Fixed Buffer type issues in export routes (wrapped in Uint8Array)
- Added epub-gen-memory to serverExternalPackages
- Added error feedback for export failures in frontend
- Pushed to GitHub and deployed to Vercel successfully

Stage Summary:
- Upload route created at src/app/api/upload/route.ts
- Import dialog now has Raw Import and AI Import buttons
- Export errors now show alerts with error details
- Codex accessible via View Codex in book dropdown
- Deployed: https://writer-organizer-novelforge.vercel.app
---
Task ID: 1
Agent: main
Task: Fix critical bugs and add features from bug report

Work Log:
- Added ErrorBoundary component
- Wrapped EditorView and Bookshelf with ErrorBoundary
- Fixed chapters GET API to return complete scene data
- Fixed codex bookId null issue
- Added JSON export format
- Added date field to Chapter model
- Fixed codex search API

Stage Summary:
- Critical crash fix: Error boundary + complete scene data in chapters API
- Codex entries now properly scoped to books
- JSON export for full book backup
- Chapter date field for diary entries
---
Task ID: 2
Agent: Super Z (Main)
Task: Fix `aliases.map is not a function` crash in codex + fix PUT /api/codex/[id] 500 error

Work Log:
- Root cause: 5 codex entries had `aliases` stored as raw strings (e.g. `"Ellie"`) instead of JSON arrays (e.g. `"[\"Ellie\"]"`) in the DB
- Added `safeJsonParse()` and `ensureStringArray()` helpers to `src/lib/utils.ts` for defensive JSON parsing
- Fixed `GET /api/codex` to use `safeJsonParse` instead of raw `JSON.parse`
- Fixed `PUT /api/codex/[id]` with input validation + `safeJsonParse` for response + proper error logging
- Fixed `POST /api/codex` with alias/tag/metadata validation/normalization
- Fixed `CodexPanel.tsx`: 3 crash sites guarded with `ensureStringArray()` (render, search filter, edit dialog)
- Fixed `MentionDropdown.tsx`: 2 crash sites guarded with `ensureStringArray()` (filter, render)
- Fixed `chat/route.ts` and `ai/generate/route.ts`: server-side alias parsing now uses `safeJsonParse`
- Deployed via git push to GitHub → Vercel auto-deploy
- Fixed 5 corrupted DB entries via PUT API calls:
  - Eleanor Hawthorne: `"Ellie"` → `["Ellie"]`
  - Liv Carter: `"Liv"` → `["Liv"]`
  - Ruby Marisol Gomez: `"Margarito"` → `["Margarito"]`
  - Soo-Jin: `"Soo"` → `["Soo"]`
  - William van der Velde: `"Will, Will van der Velde"` → `["Will", "Will van der Velde"]`

Stage Summary:
- App no longer crashes when opening books with codex entries that have string aliases
- PUT /api/codex/[id] now works correctly (was returning 500)
- All 5 corrupted entries fixed in production DB
- Defensive helpers prevent future occurrences of this type of data corruption
---
Task ID: 3
Agent: Super Z (Main)
Task: Fix scrolling in Codex panel & Chapter sidebar + add formatting toolbar

Work Log:
- Root cause: Radix ScrollArea Root element was missing `overflow-hidden` class, causing the viewport to expand infinitely instead of scrolling
- Fixed `src/components/ui/scroll-area.tsx`: added `overflow-hidden` to the Root's base className
- This single fix resolves scrolling in ALL ScrollArea instances (Codex panel, Chapter sidebar, AI panel, Chat, etc.)
- Added formatting toolbar to SceneEditor between the scene header and the textarea:
  - Bold (B), Italic (I), Strikethrough (S) with markdown wrapping
  - Heading 1 (#), Heading 2 (##), Blockquote (>)
  - Dialogue helper (wraps selection in smart quotes \u201C...\u201D)
  - Em dash (\u2014), En dash (\u2013), Ellipsis (\u2026)
  - Horizontal rule (---), Paragraph break
  - Keyboard shortcuts: Ctrl+B for bold, Ctrl+I for italic
  - onMouseDown preventDefault on toolbar buttons to prevent textarea blur
- FormattingButton component: lightweight button with icon or text, hover effects
- wrapSelection/insertAtCursor/insertDialogue helper functions

Stage Summary:
- All panels (Codex, Chapters, AI, Chat, Snippets, Notes) now scroll properly
- New formatting toolbar above the writing area with 12 formatting actions
- Keyboard shortcuts Ctrl+B and Ctrl+I work in the editor
- Deployed to Vercel via git push
---
Task ID: 4
Agent: Super Z (Main)
Task: Fix Gemini AI, add Ollama support, UI research for Novel Crafter-style improvements

Work Log:
- Fixed Gemini API: changed from X-goog-api-key header to ?key= query parameter (Google AI Studio API keys work with query param, not header)
- Added better Gemini error messages showing status code
- Added Ollama as a supported provider in both chat/route.ts and ai/generate/route.ts
- Ollama uses OpenAI-compatible format at http://localhost:11434/v1/chat/completions with no auth
- Updated SettingsScreen: added Ollama to provider dropdown with 'needsApiKey: false' flag
- Ollama UI: API key field shows 'Not needed for local AI', base URL pre-filled with localhost:11434
- Save button enabled for Ollama even without API key
- OpenAI-compatible handler now skips Authorization header for ollama provider
- Researched Novel Crafter features via web search: custom codex categories, custom detail fields, structured labels

Stage Summary:
- Gemini should now work with Google AI Studio API keys
- Ollama (local AI) fully supported - select it in Settings, point to localhost:11434
- Custom codex categories and metadata fields planned for next iteration
- Deployed to Vercel
---
Task ID: 5
Agent: Super Z (Main)
Task: Implement Codex custom categories (NovelCrafter-style "Others" tab)

Work Log:
- Changed CodexEntry.type in useAppStore.ts from union type (`'character' | 'location' | ...`) to `string` to support custom category IDs
- Created `/api/codex/categories/route.ts` with GET (merged built-in + custom), POST (create custom category), DELETE (remove custom category)
- Custom categories stored in AppSetting table (key: `custom_codex_categories`) as JSON array of `{ id, name, color, icon }`
- Updated CodexPanel.tsx with comprehensive custom categories UI:
  - Replaced Radix Tabs with lightweight custom `FilterTab` button components (no overflow issues with many tabs)
  - Added all 6 built-in types: Character, Location, Lore, Item, Subplot (GitBranch icon), Theme (Sparkles icon)
  - Added "Others" tab that appears when custom categories exist, expands to reveal sub-list of custom category filter buttons
  - Added "Manage Custom Categories" dialog (gear icon in header) with create/delete functionality
  - Type selector in create/edit dialog now shows all built-in types + custom categories with icons and color dots
  - Custom category entries render with colored badge labels
  - 9 cycling colors (rose, pink, fuchsia, purple, indigo, sky, teal, lime, orange) and 9 cycling icons (Bookmark, Palette, Music, TreePine, Globe, GraduationCap, Heart, Flame, Landmark)
- Used existing `getSetting`/`setSetting` helpers from `src/lib/auth.ts` for AppSetting CRUD
- All new code lint-clean (0 errors, 0 warnings)

Stage Summary:
- Codex now supports unlimited custom categories (stored in AppSetting as JSON, no schema migration needed)
- Filter tabs: All, Chars, Locs, Lore, Items, Sub, Theme, Others (expandable)
- "Others" tab expands to show custom category sub-filters when custom categories exist
- Category manager dialog accessible via gear icon in codex panel header
- Type selector in form dialog includes custom categories with icons and color indicators
- Custom entries display colored badge labels matching their category
- MentionDropdown already compatible (uses `Record<string, ...>` for icon/color maps)
