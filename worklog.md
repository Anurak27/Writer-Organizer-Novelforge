---
Task ID: 3
Agent: ui-improvements
Task: UI improvements and layout beautification inspired by NovelCrafter design patterns

Work Log:

### Task 1: OutlineView Enhancements (src/components/outline/OutlineView.tsx)
- Added `STATUS_DOT_COLORS` constant mapping scene statuses to dot background colors
- Enhanced scene row preview text: notes now show with a styled "Notes:" prefix in amber, and the text color improved from `text-zinc-600` to `text-zinc-500` for better readability
- Added chapter progress indicator bar: calculates completed scenes percentage, displays with a colored progress bar (emerald for 100%, amber for ≥50%, zinc for <50%)
- Added `completedScenes`, `totalScenes`, `progressPercent`, `progressColor` computed values to `ChapterBlock`
- Redesigned chapter header: synopsis area now gets a rounded-lg container with bg-zinc-900/50 and border when text exists; placeholder uses italic styling
- Added prominent word count display in a styled badge (bg-zinc-800/50 rounded-md) showing "X words" instead of just "Xw"
- Added scene count badge in similar styled container
- Added gradient visual separator between chapters: a subtle `bg-gradient-to-b from-amber-500/0 via-amber-500/20 to-amber-500/0` line
- Added stats bar at the top of chapter list: 3-column grid showing Chapters, Scenes, and Words counts with prominent styling and amber accent on word count
- Reduced chapter spacing from `space-y-6` to `space-y-2` for denser, more professional layout

### Task 2: EditorView Layout Enhancements (src/components/editor/EditorView.tsx)
- Added `TAB_LABELS` constant mapping right panel tab values to human-readable labels
- Added `activeBook` store selector to access current book data
- Replaced 'Current Book' hardcoded text with `activeBook?.title` fallback chain
- Added subtle gradient glow effect behind top nav stats: an absolutely-positioned `bg-gradient-to-r from-transparent via-amber-500/[0.03] to-transparent` div
- Added visual mode indicator pill showing the currently active right panel tab (e.g., "CODEX", "AI ASSIST") with amber styling and animated pulse dot when a scene is active
- Added inactive state indicator (zinc styled) when no scene is selected
- Made right panel wider on xl screens: changed from `w-72 lg:w-80` to `w-72 lg:w-80 xl:w-84`
- Changed all tab triggers from bottom border (`border-b-2`) to left border accent (`border-l-2 border-amber-500`) for active tab indication
- Compact stats display: shortened "chapters" to "ch", "scenes" to "sc", "words" to "w" with tabular-nums alignment

### Task 3: ChapterSidebar Enhancements (src/components/editor/ChapterSidebar.tsx)
- Added `SCENE_STATUS_DOTS` constant mapping scene statuses to colored dot classes (zinc, blue, amber, orange, emerald)
- Added Tooltip imports from shadcn/ui
- Replaced `FileText` icon on scene rows with colored status indicator dots (2x2 rounded circles)
- Added chapter synopsis tooltip: when chapter is collapsed and has a synopsis, hovering shows a rich tooltip (max-w-250px, 4-line clamp)
- Wrapped chapter rows in `TooltipProvider` + `Tooltip` for synopsis display
- Added word count progress bar per chapter: thin 0.5px bar below each chapter showing scene completion progress (emerald/amber/zinc color coded)
- Improved scene count and word count badges: styled as `bg-zinc-800/80 rounded-md` pill badges with "Xsc" and "Xk w" / "Xw" format using tabular-nums
- Enhanced visual hierarchy: chapter title now uses `font-medium`, chapter row has `rounded-md mx-1` for spacing, increased padding to `py-2`
- Active scene title now highlighted with `text-zinc-200 font-medium` vs inactive `text-zinc-400`
- Word count numbers now use `tabular-nums` for aligned digits
- Changed chapter map from arrow function to block function to compute per-chapter stats (completed scenes, progress percentage)

### Task 4: SceneDetailsPanel Enhancements (src/components/editor/SceneDetailsPanel.tsx)
- Added imports: `User`, `Pin`, `PinOff`, `BookOpen`, `Layers` from lucide-react; `Button` from shadcn/ui; `Separator` from shadcn/ui
- Added `codexEntries` store selector for accessing codex data
- Added scene number calculation: finds the scene's index within its parent chapter and displays as a badge ("Scene N")
- Added chapter summary display: shows parent chapter title and synopsis in a styled container with `bg-zinc-900/50 border border-zinc-800/50 rounded-md`
- Added Character/POV selector: dropdown showing codex entries of type 'character' with their colored dots, writes selected character ID to the scene's `pov` field
- Added pinned codex entries display: parses `pinnedCodexIds` JSON, shows each pinned entry with color dot, name, type, and an unpin button (hover-visible PinOff icon)
- Added "last edited" indicator: shows `updatedAt` formatted as "Mon DD, HH:MM" with a Clock icon, displayed inline with word count
- Added section dividers (Separator components) between all major sections for clear visual separation
- Reduced spacing from `space-y-5` to `space-y-4` for tighter, more information-dense layout

Stage Summary:
- All four UI components have been enhanced with NovelCrafter-inspired visual improvements
- OutlineView now features prominent synopsis areas, chapter progress bars, gradient separators, and a top stats dashboard
- EditorView now displays the actual book title, has a subtle gradient glow, shows an active panel mode indicator, and uses left border accents on tabs with a wider right panel
- ChapterSidebar now shows scene status dots, chapter synopsis tooltips, per-chapter progress bars, and styled count badges
- SceneDetailsPanel now displays scene numbers, chapter summaries, character/POV selectors, pinned codex entries with unpin capability, last-edited timestamps, and proper section dividers
- No new lint errors introduced (3 pre-existing issues remain unchanged)
