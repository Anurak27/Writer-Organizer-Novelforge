import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, setSetting, generateSessionToken } from '@/lib/auth';

// TEMPORARY one-time password reset endpoint — REMOVE AFTER USE
// This endpoint does NOT require authentication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
    }

    const hash = await hashPassword(newPassword);
    await setSetting('master_password_hash', hash);

    // Generate a new session token
    const newToken = generateSessionToken();
    await setSetting('session_token', newToken);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
      token: newToken,
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return NextResponse.json({ error: 'Reset failed', details: String(err) }, { status: 500 });
  }
}
