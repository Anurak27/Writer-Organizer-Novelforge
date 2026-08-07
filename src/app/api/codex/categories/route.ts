import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, getSetting, setSetting } from '@/lib/auth';

export interface CustomCodexCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const BUILT_IN_TYPES = [
  { id: 'character', name: 'Character', color: 'violet', icon: 'User', isBuiltin: true },
  { id: 'location', name: 'Location', color: 'emerald', icon: 'MapPin', isBuiltin: true },
  { id: 'lore', name: 'Lore', color: 'amber', icon: 'ScrollText', isBuiltin: true },
  { id: 'item', name: 'Item', color: 'cyan', icon: 'Gem', isBuiltin: true },
  { id: 'subplot', name: 'Subplot', color: 'rose', icon: 'GitBranch', isBuiltin: true },
  { id: 'theme', name: 'Theme', color: 'sky', icon: 'Sparkles', isBuiltin: true },
  { id: 'style', name: 'Style Guide', color: 'pink', icon: 'Feather', isBuiltin: true },
  { id: 'festival', name: 'Festival', color: 'orange', icon: 'Calendar', isBuiltin: true },
  { id: 'key_element', name: 'Key Element', color: 'fuchsia', icon: 'KeyRound', isBuiltin: true },
  { id: 'synopsis', name: 'Synopsis', color: 'indigo', icon: 'FileText', isBuiltin: true },
  { id: 'core_message', name: 'Core Message', color: 'teal', icon: 'Target', isBuiltin: true },
  { id: 'diary_structure', name: 'Diary Structure', color: 'lime', icon: 'BookOpen', isBuiltin: true },
];

const CUSTOM_COLORS = [
  'rose', 'pink', 'fuchsia', 'purple', 'indigo',
  'sky', 'teal', 'lime', 'orange',
];

const CUSTOM_ICONS = [
  'Bookmark', 'Palette', 'Music', 'TreePine', 'Globe',
  'GraduationCap', 'Heart', 'Flame', 'Landmark',
  'Feather', 'Calendar', 'KeyRound', 'FileText', 'Target', 'BookOpen',
];

function getNextColor(existing: CustomCodexCategory[]): string {
  const usedColors = existing.map((c) => c.color);
  for (const color of CUSTOM_COLORS) {
    if (!usedColors.includes(color)) return color;
  }
  return CUSTOM_COLORS[existing.length % CUSTOM_COLORS.length];
}

function getNextIcon(existing: CustomCodexCategory[]): string {
  const usedIcons = existing.map((c) => c.icon);
  for (const icon of CUSTOM_ICONS) {
    if (!usedIcons.includes(icon)) return icon;
  }
  return CUSTOM_ICONS[existing.length % CUSTOM_ICONS.length];
}

async function getCustomCategories(): Promise<CustomCodexCategory[]> {
  const raw = await getSetting('custom_codex_categories');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c: unknown) =>
          c &&
          typeof c === 'object' &&
          'id' in c &&
          'name' in c &&
          'color' in c &&
          'icon' in c
      ) as CustomCodexCategory[];
    }
  } catch {
    // corrupted data
  }
  return [];
}

async function saveCustomCategories(categories: CustomCodexCategory[]): Promise<void> {
  await setSetting('custom_codex_categories', JSON.stringify(categories));
}

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const custom = await getCustomCategories();
    return NextResponse.json({
      builtIn: BUILT_IN_TYPES,
      custom,
      all: [...BUILT_IN_TYPES, ...custom.map((c) => ({ ...c, isBuiltin: false }))],
    });
  } catch (error) {
    console.error('[GET /api/codex/categories] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const existing = await getCustomCategories();
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newCategory: CustomCodexCategory = {
      id,
      name: name.trim(),
      color: getNextColor(existing),
      icon: getNextIcon(existing),
    };

    existing.push(newCategory);
    await saveCustomCategories(existing);

    return NextResponse.json({ ...newCategory, isBuiltin: false }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/codex/categories] Error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    const existing = await getCustomCategories();
    const filtered = existing.filter((c) => c.id !== id);

    if (filtered.length === existing.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await saveCustomCategories(filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/codex/categories] Error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
