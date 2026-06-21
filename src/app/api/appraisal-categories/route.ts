import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || undefined;

    const where: Record<string, unknown> = {};
    if (section) {
      where.section = section;
    }

    const categories = await db.appraisalCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        ratingScale: true,
      },
    });

    return NextResponse.json({ appraisalCategories: categories });
  } catch (error) {
    console.error('List appraisal categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {  const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;

    try {
    const body = await request.json();
    const { name, section, description, sortOrder, ratingScaleId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    if (!section || !section.trim()) {
      return NextResponse.json({ error: 'Category section is required' }, { status: 400 });
    }

    const category = await db.appraisalCategory.create({
      data: {
        name: name.trim(),
        section: section.trim(),
        description: description || '',
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        ratingScaleId: ratingScaleId || null,
      },
      include: {
        ratingScale: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Create appraisal category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
