import { NextRequest, NextResponse } from 'next/server';
import { isPasswordSet, hashPassword, setSetting, verifyPassword, generateSessionToken } from '@/lib/auth';

export async function GET() {
  try {
    const set = await isPasswordSet();
    return NextResponse.json({ passwordSet: set });
  } catch {
    return NextResponse.json({ error: 'Failed to check auth status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, password } = await request.json();

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const set = await isPasswordSet();

    if (action === 'setup') {
      if (set) {
        return NextResponse.json({ error: 'Password already set. Use login instead.' }, { status: 400 });
      }
      const hash = await hashPassword(password);
      await setSetting('master_password_hash', hash);
      const token = generateSessionToken();
      await setSetting('session_token', token);
      return NextResponse.json({ success: true, token });
    }

    if (action === 'login') {
      if (!set) {
        return NextResponse.json({ error: 'No password set. Use setup first.' }, { status: 400 });
      }
      const storedHash = await (await import('@/lib/auth')).getSetting('master_password_hash');
      if (!storedHash) {
        return NextResponse.json({ error: 'Auth configuration error' }, { status: 500 });
      }
      const valid = await verifyPassword(password, storedHash);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
      const token = generateSessionToken();
      await setSetting('session_token', token);
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json({ error: 'Invalid action. Use "setup" or "login".' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Auth request failed' }, { status: 500 });
  }
}