import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { safeJsonParse } from '@/lib/utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const entry = await db.codexEntry.findUnique({ where: { id } });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    return NextResponse.json({
      ...entry,
      aliases: safeJsonParse<string[]>(entry.aliases, [], true),
      tags: safeJsonParse<string[]>(entry.tags, [], true),
      metadata: safeJsonParse<Record<string, string>>(entry.metadata, {}),
    });
  } catch (error) {
    console.error('[GET /api/codex/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch codex entry' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await request.json();

    // Validate and normalize array fields if provided
    let aliasesStr: string | undefined;
    if (body.aliases !== undefined) {
      const normalized = Array.isArray(body.aliases)
        ? body.aliases.filter((a): a is string => typeof a === 'string').map(a => a.trim()).filter(Boolean)
        : [];
      aliasesStr = JSON.stringify(normalized);
    }

    let tagsStr: string | undefined;
    if (body.tags !== undefined) {
      const normalized = Array.isArray(body.tags)
        ? body.tags.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
        : [];
      tagsStr = JSON.stringify(normalized);
    }

    let metadataStr: string | undefined;
    if (body.metadata !== undefined) {
      const normalized = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {};
      metadataStr = JSON.stringify(normalized);
    }

    const entry = await db.codexEntry.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || '' }),
        ...(aliasesStr !== undefined && { aliases: aliasesStr }),
        ...(tagsStr !== undefined && { tags: tagsStr }),
        ...(metadataStr !== undefined && { metadata: metadataStr }),
        ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
        ...(body.bookId !== undefined && { bookId: body.bookId || null }),
        ...(body.imagePath !== undefined && { imagePath: body.imagePath || null }),
      },
    });

    return NextResponse.json({
      ...entry,
      aliases: safeJsonParse<string[]>(entry.aliases, [], true),
      tags: safeJsonParse<string[]>(entry.tags, [], true),
      metadata: safeJsonParse<Record<string, string>>(entry.metadata, {}),
    });
  } catch (error) {
    console.error('[PUT /api/codex/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update codex entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.codexEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/codex/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete codex entry' }, { status: 500 });
  }
}