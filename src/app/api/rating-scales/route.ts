import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appliesTo = searchParams.get('appliesTo') || undefined;

    const where: Record<string, unknown> = {};
    if (appliesTo) {
      where.appliesTo = appliesTo;
    }

    const scales = await db.ratingScale.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });

    return NextResponse.json({ ratingScales: scales });
  } catch (error) {
    console.error('List rating scales error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {  const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;

    try {
    const body = await request.json();
    const {
      name,
      description,
      minScore,
      maxScore,
      labelsJson,
      appliesTo,
      sortOrder,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Rating scale name is required' }, { status: 400 });
    }

    const scale = await db.ratingScale.create({
      data: {
        name: name.trim(),
        description: description || '',
        minScore: minScore !== undefined ? Number(minScore) : 0,
        maxScore: maxScore !== undefined ? Number(maxScore) : 5,
        labelsJson: labelsJson || '[]',
        appliesTo: appliesTo || '',
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json(scale, { status: 201 });
  } catch (error) {
    console.error('Create rating scale error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
