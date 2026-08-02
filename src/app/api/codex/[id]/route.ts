import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

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
      aliases: JSON.parse(entry.aliases || '[]'),
      tags: JSON.parse(entry.tags || '[]'),
      metadata: JSON.parse(entry.metadata || '{}'),
    });
  } catch {
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
    const entry = await db.codexEntry.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || '' }),
        ...(body.aliases !== undefined && { aliases: JSON.stringify(body.aliases) }),
        ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
        ...(body.metadata !== undefined && { metadata: JSON.stringify(body.metadata) }),
        ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
        ...(body.bookId !== undefined && { bookId: body.bookId || null }),
        ...(body.imagePath !== undefined && { imagePath: body.imagePath || null }),
      },
    });

    return NextResponse.json({
      ...entry,
      aliases: JSON.parse(entry.aliases),
      tags: JSON.parse(entry.tags),
      metadata: JSON.parse(entry.metadata),
    });
  } catch {
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
  } catch {
    return NextResponse.json({ error: 'Failed to delete codex entry' }, { status: 500 });
  }
}