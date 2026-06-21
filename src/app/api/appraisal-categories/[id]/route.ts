import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await db.appraisalCategory.findUnique({
      where: { id },
      include: {
        ratingScale: true,
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Appraisal category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Get appraisal category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await request.json();

    const existing = await db.appraisalCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Appraisal category not found' }, { status: 404 });
    }

    if (body.name !== undefined && (!body.name || !body.name.trim())) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    if (body.section !== undefined && (!body.section || !body.section.trim())) {
      return NextResponse.json({ error: 'Category section is required' }, { status: 400 });
    }

    const updated = await db.appraisalCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.section !== undefined && { section: body.section.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
        ...(body.ratingScaleId !== undefined && {
          ratingScaleId: body.ratingScaleId || null,
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        ratingScale: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update appraisal category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;
    const { id } = await params;

    const existing = await db.appraisalCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Appraisal category not found' }, { status: 404 });
    }

    // Categories used in appraisal templates should never be permanently deleted.
    // Always deactivate.
    await db.appraisalCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: 'Appraisal category deactivated',
      deactivated: true,
    });
  } catch (error) {
    console.error('Delete appraisal category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

