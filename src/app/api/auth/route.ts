import { NextRequest, NextResponse } from 'next/server';
import { isPasswordSet, hashPassword, setSetting, verifyPassword, generateSessionToken } from '@/lib/auth';

export async function GET() {
  try {
    const set = await isPasswordSet();
    return NextResponse.json({ passwordSet: set });
  } catch (err) {
    console.error('Auth GET error:', err);
    return NextResponse.json({ error: 'Failed to check auth status', details: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, password, currentPassword, newPassword } = body;

    if (action !== 'change_password' && (!password || password.length < 4)) {
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

    if (action === 'change_password') {
      if (!set) {
        return NextResponse.json({ error: 'No password set.' }, { status: 400 });
      }
      if (!currentPassword || !newPassword || newPassword.length < 4) {
        return NextResponse.json({ error: 'Current password and new password (min 4 chars) are required.' }, { status: 400 });
      }
      const { getSetting } = await import('@/lib/auth');
      const storedHash = await getSetting('master_password_hash');
      if (!storedHash) {
        return NextResponse.json({ error: 'Auth configuration error' }, { status: 500 });
      }
      const valid = await verifyPassword(currentPassword, storedHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      }
      const newHash = await hashPassword(newPassword);
      await setSetting('master_password_hash', newHash);
      // Generate new session token so user stays logged in
      const newToken = generateSessionToken();
      await setSetting('session_token', newToken);
      return NextResponse.json({ success: true, token: newToken, message: 'Password changed successfully.' });
    }

    if (action === 'login') {
      if (!set) {
        return NextResponse.json({ error: 'No password set. Use setup first.' }, { status: 400 });
      }
      const { getSetting } = await import('@/lib/auth');
      const storedHash = await getSetting('master_password_hash');
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

    return NextResponse.json({ error: 'Invalid action. Use "setup", "login", or "change_password".' }, { status: 400 });
  } catch (err) {
    console.error('Auth POST error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // Detect common database connection issues
    if (msg.includes('connect') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      return NextResponse.json({ 
        error: 'Database connection failed. Make sure DATABASE_URL is set correctly in Vercel environment variables.', 
        details: msg 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Auth request failed', details: msg }, { status: 500 });
  }
}
