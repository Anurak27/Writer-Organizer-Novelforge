import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: chapterId } = await params;

  try {
    const scenes = await db.scene.findMany({
      where: { chapterId },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(scenes);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scenes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: chapterId } = await params;

  try {
    const { title, notes } = await request.json();
    const maxOrder = await db.scene.findFirst({
      where: { chapterId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const scene = await db.scene.create({
      data: {
        chapterId,
        title: title?.trim() || 'Untitled Scene',
        notes: notes?.trim() || null,
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(scene, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create scene' }, { status: 500 });
  }
}