import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Fetch public templates + user's private templates
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { isPublic: true },
          session?.user?.email ? { user: { email: session.user.email } } : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, image: true }
        }
      }
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { name, content, isPublic, thumbnail } = await req.json();

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        name,
        content,
        isPublic: isPublic || false,
        thumbnail,
        userId: session?.user ? (session.user as any).id : null,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
