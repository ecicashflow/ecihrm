import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signSession, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Verify password (bcrypt). Supports legacy plaintext via direct compare for transition only.
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      // Legacy fallback: if the stored password is NOT a bcrypt hash but matches plaintext.
      // This only applies during migration; the seed script now always hashes.
      if (user.password === password && !user.password.startsWith('$2')) {
        // Upgrade to bcrypt on the fly
        const hashed = await bcrypt.hash(password, 12);
        await db.user.update({ where: { id: user.id }, data: { password: hashed } });
      } else {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
    }

    // Issue session JWT
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      employeeId: user.employeeId,
      designation: user.designation,
      department: user.department,
      phone: user.phone,
      overallExp: user.overallExp,
      yearsWithECI: user.yearsWithECI,
      currentEdu: user.currentEdu,
      role: user.role,
      isActive: user.isActive,
      isSupervisor: user.isSupervisor,
      lineManagerId: user.lineManagerId,
      lineManager: user.lineManager,
    };

    const response = NextResponse.json(safeUser);
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
