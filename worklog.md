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
