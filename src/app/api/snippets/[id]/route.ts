import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const snippet = await db.snippet.findUnique({ where: { id } });
    if (!snippet) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...snippet,
      tags: JSON.parse(snippet.tags || '[]'),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch snippet' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      data.title = body.title.trim();
    }
    if (body.content !== undefined) {
      data.content = body.content?.trim() || '';
    }
    if (body.category !== undefined) {
      data.category = body.category;
    }
    if (body.tags !== undefined) {
      data.tags = JSON.stringify(body.tags);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = body.sortOrder;
    }

    const snippet = await db.snippet.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...snippet,
      tags: JSON.parse(snippet.tags || '[]'),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update snippet' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.snippet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete snippet' }, { status: 500 });
  }
}