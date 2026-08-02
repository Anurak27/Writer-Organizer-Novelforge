import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import epubGen from 'epub-gen-memory';

export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bookId, format, sections } = body; // sections: 'manuscript' | 'outline' | 'codex' | 'all'
    if (!bookId || !format) {
      return NextResponse.json({ error: 'Missing bookId or format' }, { status: 400 });
    }

    const allowedFormats = ['pdf', 'docx', 'txt', 'epub'];
    if (!allowedFormats.includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    // Fetch book data
    const book = await db.book.findUnique({ where: { id: bookId } });
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const chapters = await db.chapter.findMany({
      where: { bookId },
      orderBy: { sortOrder: 'asc' },
      include: {
        scenes: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const codexEntries = await db.codexEntry.findMany({
      where: { bookId },
      orderBy: { type: 'asc' },
    });

    const wantManuscript = sections === 'manuscript' || sections === 'all';
    const wantOutline = sections === 'outline' || sections === 'all';
    const wantCodex = sections === 'codex' || sections === 'all';

    // Helper: resolve image path to buffer
    const getImageBuffer = async (imgPath: string): Promise<Buffer | null> => {
      if (!imgPath) return null;
      const fullPath = join(process.cwd(), imgPath);
      if (!existsSync(fullPath)) return null;
      return readFile(fullPath);
    };

    // Helper: parse inline images from content markdown-like syntax ![alt](path)
    const parseInlineImages = async (content: string): Promise<Array<{alt: string, path: string, buffer: Buffer | null}>> => {
      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const images: Array<{alt: string, path: string, buffer: Buffer | null}> = [];
      let match;
      while ((match = regex.exec(content)) !== null) {
        const [, alt, path] = match;
        const buffer = await getImageBuffer(path);
        images.push({ alt, path, buffer });
      }
      return images;
    };

    // Strip image markdown tags to plain text
    const stripImageTags = (content: string): string => {
      return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[Image: $1]');
    };

    if (format === 'txt') {
      let txt = '';
      txt += `${'='.repeat(60)}\n`;
      txt += `${book.title}\n`;
      if (book.penName) txt += `by ${book.penName}\n`;
      txt += `${'='.repeat(60)}\n\n`;

      if (wantManuscript) {
        txt += `--- MANUSCRIPT ---\n\n`;
        for (const ch of chapters) {
          txt += `Chapter: ${ch.title}\n`;
          if (ch.synopsis) txt += `${ch.synopsis}\n`;
          txt += `${'─'.repeat(40)}\n\n`;
          for (const sc of ch.scenes) {
            if (ch.scenes.length > 1) txt += `§ ${sc.title}\n\n`;
            txt += stripImageTags(sc.content) + '\n\n';
          }
        }
      }

      if (wantOutline) {
        txt += `--- OUTLINE ---\n\n`;
        for (const ch of chapters) {
          txt += `• ${ch.title}`;
          if (ch.synopsis) txt += ` — ${ch.synopsis}`;
          txt += '\n';
          for (const sc of ch.scenes) {
            txt += `  ◦ ${sc.title}`;
            if (sc.notes) txt += ` [${sc.notes.slice(0, 80)}]`;
            txt += '\n';
          }
        }
        txt += '\n';
      }

      if (wantCodex) {
        txt += `--- CODEX (STORY BIBLE) ---\n\n`;
        const grouped: Record<string, typeof codexEntries> = {};
        for (const e of codexEntries) {
          if (!grouped[e.type]) grouped[e.type] = [];
          grouped[e.type].push(e);
        }
        for (const [type, entries] of Object.entries(grouped)) {
          txt += `${type.toUpperCase()}S:\n`;
          for (const e of entries) {
            txt += `  ${e.name}\n`;
            txt += `  ${e.description}\n\n`;
          }
        }
      }

      return new NextResponse(txt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt"`,
        },
      });
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: book.title,
          Author: book.penName || 'Unknown',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      // Title page
      doc.moveDown(6);
      doc.fontSize(28).font('Helvetica-Bold').text(book.title, { align: 'center' });
      if (book.penName) {
        doc.moveDown(1);
        doc.fontSize(16).font('Helvetica').text(`by ${book.penName}`, { align: 'center' });
      }
      if (book.genre) {
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Oblique').text(book.genre, { align: 'center' });
      }
      doc.addPage();

      if (wantManuscript) {
        for (const ch of chapters) {
          doc.fontSize(20).font('Helvetica-Bold').text(ch.title);
          doc.moveDown(0.5);
          if (ch.synopsis) {
            doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666').text(ch.synopsis);
            doc.fillColor('#000');
            doc.moveDown(0.5);
          }
          for (const sc of ch.scenes) {
            if (ch.scenes.length > 1) {
              doc.fontSize(13).font('Helvetica-Bold').text(sc.title);
              doc.moveDown(0.3);
            }
            doc.fontSize(11).font('Helvetica').text(stripImageTags(sc.content), { lineGap: 4 });
            // Handle inline images
            const imgs = await parseInlineImages(sc.content);
            for (const img of imgs) {
              if (img.buffer) {
                try {
                  doc.moveDown(0.5);
                  doc.image(img.buffer, { width: 300, align: 'center' });
                  doc.moveDown(0.5);
                } catch {
                  // skip invalid images
                }
              }
            }
            doc.moveDown(1);
          }
          doc.addPage();
        }
      }

      if (wantCodex) {
        doc.fontSize(20).font('Helvetica-Bold').text('Story Bible (Codex)');
        doc.moveDown(0.5);
        const grouped: Record<string, typeof codexEntries> = {};
        for (const e of codexEntries) {
          if (!grouped[e.type]) grouped[e.type] = [];
          grouped[e.type].push(e);
        }
        for (const [type, entries] of Object.entries(grouped)) {
          doc.fontSize(14).font('Helvetica-Bold').text(type.toUpperCase() + 'S');
          doc.moveDown(0.3);
          for (const e of entries) {
            doc.fontSize(12).font('Helvetica-Bold').text(e.name);
            // Try to add codex image
            if (e.imagePath) {
              const imgBuf = await getImageBuffer(e.imagePath);
              if (imgBuf) {
                try { doc.image(imgBuf, { width: 80, align: 'left' }); doc.moveDown(0.3); } catch { /* skip */ }
              }
            }
            doc.fontSize(10).font('Helvetica').text(e.description, { lineGap: 3 });
            doc.moveDown(0.5);
          }
          doc.moveDown(0.5);
        }
      }

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        },
      });
    }

    if (format === 'docx') {
      const children: any[] = [];

      // Title
      children.push(
        new Paragraph({
          children: [new TextRun({ text: book.title, bold: true, size: 56 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
      if (book.penName) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `by ${book.penName}`, italics: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          })
        );
      }
      children.push(new Paragraph({ children: [] })); // page break effect

      if (wantManuscript) {
        for (const ch of chapters) {
          children.push(
            new Paragraph({
              text: ch.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );
          if (ch.synopsis) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: ch.synopsis, italics: true, color: '666666', size: 20 })],
                spacing: { after: 200 },
              })
            );
          }
          for (const sc of ch.scenes) {
            if (ch.scenes.length > 1) {
              children.push(
                new Paragraph({
                  text: sc.title,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 100 },
                })
              );
            }
            const textContent = stripImageTags(sc.content);
            const paragraphs = textContent.split('\n').filter((p: string) => p.trim());
            for (const p of paragraphs) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: p, size: 22 })],
                  spacing: { after: 120, line: 360 },
                })
              );
            }
            // Inline images
            const imgs = await parseInlineImages(sc.content);
            for (const img of imgs) {
              if (img.buffer) {
                try {
                  children.push(
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: img.buffer,
                          transformation: { width: 500, height: 375 },
                          type: 'png',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 200, after: 200 },
                    })
                  );
                } catch { /* skip */ }
              }
            }
          }
        }
      }

      if (wantCodex) {
        children.push(
          new Paragraph({
            text: 'Story Bible (Codex)',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
          })
        );
        const grouped: Record<string, typeof codexEntries> = {};
        for (const e of codexEntries) {
          if (!grouped[e.type]) grouped[e.type] = [];
          grouped[e.type].push(e);
        }
        for (const [type, entries] of Object.entries(grouped)) {
          children.push(
            new Paragraph({
              text: type.toUpperCase() + 'S',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            })
          );
          for (const e of entries) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: e.name, bold: true, size: 24 })],
                spacing: { before: 200, after: 50 },
              })
            );
            children.push(
              new Paragraph({
                children: [new TextRun({ text: e.description, size: 20 })],
                spacing: { after: 200 },
              })
            );
          }
        }
      }

      const docBlob = await Packer.toBuffer(
        new Document({
          creator: 'NovelForge',
          title: book.title,
          description: book.description || '',
          sections: [{ children }],
        })
      );

      return new NextResponse(docBlob, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`,
        },
      });
    }

    if (format === 'epub') {
      const content: any[] = [];

      // Title page
      content.push({
        title: book.title,
        data: `<div style="text-align:center;margin-top:40%;"><h1>${book.title}</h1>${book.penName ? `<h3>by ${book.penName}</h3>` : ''}${book.genre ? `<p><em>${book.genre}</em></p>` : ''}</div>`,
      });

      if (wantManuscript) {
        for (const ch of chapters) {
          let html = `<h2>${ch.title}</h2>`;
          if (ch.synopsis) html += `<p><em>${ch.synopsis}</em></p>`;
          for (const sc of ch.scenes) {
            if (ch.scenes.length > 1) html += `<h3>${sc.title}</h3>`;
            // Convert newlines to paragraphs, preserve inline images
            const paragraphs = sc.content.split('\n').filter((p: string) => p.trim());
            for (const p of paragraphs) {
              // Check if it's an image tag
              const imgMatch = p.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
              if (imgMatch) {
                html += `<p style="text-align:center;"><em>[Image: ${imgMatch[1]}]</em></p>`;
              } else {
                html += `<p>${p}</p>`;
              }
            }
          }
          content.push({ title: ch.title, data: html });
        }
      }

      if (wantCodex) {
        let html = '<h2>Story Bible (Codex)</h2>';
        const grouped: Record<string, typeof codexEntries> = {};
        for (const e of codexEntries) {
          if (!grouped[e.type]) grouped[e.type] = [];
          grouped[e.type].push(e);
        }
        for (const [type, entries] of Object.entries(grouped)) {
          html += `<h3>${type.toUpperCase()}S</h3>`;
          for (const e of entries) {
            html += `<h4>${e.name}</h4><p>${e.description}</p>`;
          }
        }
        content.push({ title: 'Codex', data: html });
      }

      const epubBuffer = await epubGen.default({
        title: book.title,
        author: book.penName || 'Unknown',
        content,
      });

      return new NextResponse(epubBuffer, {
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Disposition': `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.epub"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
