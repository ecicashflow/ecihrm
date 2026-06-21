import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const scale = await db.ratingScale.findUnique({
      where: { id },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!scale) {
      return NextResponse.json({ error: 'Rating scale not found' }, { status: 404 });
    }

    return NextResponse.json(scale);
  } catch (error) {
    console.error('Get rating scale error:', error);
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

    const existing = await db.ratingScale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rating scale not found' }, { status: 404 });
    }

    if (body.name !== undefined && (!body.name || !body.name.trim())) {
      return NextResponse.json({ error: 'Rating scale name is required' }, { status: 400 });
    }

    const updated = await db.ratingScale.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.minScore !== undefined && { minScore: Number(body.minScore) }),
        ...(body.maxScore !== undefined && { maxScore: Number(body.maxScore) }),
        ...(body.labelsJson !== undefined && { labelsJson: body.labelsJson }),
        ...(body.appliesTo !== undefined && { appliesTo: body.appliesTo }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update rating scale error:', error);
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

    const existing = await db.ratingScale.findUnique({
      where: { id },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Rating scale not found' }, { status: 404 });
    }

    if (existing._count.categories > 0) {
      // Safe deactivate — categories reference this scale
      await db.ratingScale.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: 'Rating scale deactivated (referenced by categories)',
        deactivated: true,
        linkedCount: existing._count.categories,
      });
    }

    // No categories — permanent delete
    await db.ratingScale.delete({ where: { id } });
    return NextResponse.json({
      message: 'Rating scale deleted',
      deactivated: false,
    });
  } catch (error) {
    console.error('Delete rating scale error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

