import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await db.aiConfig.findMany({ orderBy: { createdAt: 'desc' } });
    // Mask the API keys for safety
    const masked = configs.map((c) => ({
      ...c,
      apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...${c.apiKey.slice(-4)}` : '',
    }));
    return NextResponse.json(masked);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch AI configs' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider, apiKey, modelName, isActive } = await request.json();

    if (!provider || !apiKey?.trim()) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 });
    }

    // Deactivate all configs for this provider first
    await db.aiConfig.updateMany({ where: { provider }, data: { isActive: false } });

    // Check if a config for this provider already exists
    const existing = await db.aiConfig.findFirst({ where: { provider } });

    let config;
    if (existing) {
      config = await db.aiConfig.update({
        where: { id: existing.id },
        data: {
          apiKey: apiKey.trim(),
          modelName: modelName?.trim() || null,
          isActive: isActive ?? true,
        },
      });
    } else {
      config = await db.aiConfig.create({
        data: {
          provider,
          apiKey: apiKey.trim(),
          modelName: modelName?.trim() || null,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      ...config,
      apiKey: `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}`,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save AI config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { provider } = await request.json();
    if (provider) {
      await db.aiConfig.deleteMany({ where: { provider } });
    } else {
      await db.aiConfig.deleteMany();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete AI configs' }, { status: 500 });
  }
}