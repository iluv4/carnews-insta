import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authError) {
      console.error('NextAuth session fetch failed:', authError);
    }
    
    // Fetch public templates + user's private templates from DB
    let dbTemplates: any[] = [];
    try {
      const whereClause: any = {
        OR: [
          { isPublic: true },
        ]
      };
      
      if (session?.user?.email) {
        whereClause.OR.push({ user: { email: session.user.email } });
      }

      dbTemplates = await prisma.template.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, image: true }
          }
        }
      });
    } catch (dbError) {
      console.error('Database connection failed, falling back to local templates only:', dbError);
    }
    
    // Load local templates from filesystem
    const localTemplatesDir = path.join(process.cwd(), 'src/templates');
    let localTemplates: any[] = [];
    if (fs.existsSync(localTemplatesDir)) {
      const indexFile = path.join(localTemplatesDir, 'index.json');
      if (fs.existsSync(indexFile)) {
        try {
          const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
          localTemplates = indexData.map((t: any) => ({
            id: `local-${t.id}`,
            name: t.name,
            content: fs.readFileSync(path.join(localTemplatesDir, t.file), 'utf8'),
            thumbnail: `/templates/${t.id}.png`,
            isPublic: true,
            user: { name: 'System', image: '' }
          }));
        } catch (fsError) {
          console.error('Failed to read local templates:', fsError);
        }
      }
    }

    return NextResponse.json({ templates: [...localTemplates, ...dbTemplates] });
  } catch (error: any) {
    console.error('Template API Error:', error);
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
