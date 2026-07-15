import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, calculateWordCount } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const scene = await db.scene.findUnique({ where: { id } });
    if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    return NextResponse.json(scene);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scene' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await request.json();
    const wc = calculateWordCount(body.content ?? '');
    const scene = await db.scene.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        wordCount: wc,
      },
    });
    return NextResponse.json(scene);
  } catch {
    return NextResponse.json({ error: 'Failed to update scene' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.scene.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete scene' }, { status: 500 });
  }
}