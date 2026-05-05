import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const cards = await prisma.generatedCard.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error('Fetch Cards Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, imageUrl, theme, jsonlData } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const card = await prisma.generatedCard.create({
      data: {
        userId,
        imageUrl,
        theme,
        jsonlData,
      },
    });

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Save Card Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
