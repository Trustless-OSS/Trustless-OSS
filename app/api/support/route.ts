import { NextRequest, NextResponse } from 'next/server';
import { isSupportCategory, type StoredSupportRequest } from '@/lib/support';

// In-memory storage (replace with database in production)
const supportRequests: StoredSupportRequest[] = [];

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  try {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid support request' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    if (
      typeof payload.subject !== 'string' ||
      payload.subject.trim().length === 0 ||
      typeof payload.message !== 'string' ||
      payload.message.trim().length === 0 ||
      typeof payload.category !== 'string' ||
      !isSupportCategory(payload.category) ||
      (payload.org !== undefined && typeof payload.org !== 'string') ||
      (payload.attachment !== undefined &&
        (typeof payload.attachment !== 'string' ||
          !/^data:(image|video)\/[^;]+;base64,/.test(payload.attachment)))
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid support request fields' },
        { status: 400 }
      );
    }

    const supportRequest: StoredSupportRequest = {
      category: payload.category,
      subject: payload.subject.trim(),
      message: payload.message.trim(),
      ...(typeof payload.org === 'string' && payload.org.trim() ? { org: payload.org.trim() } : {}),
      ...(typeof payload.attachment === 'string' ? { attachment: payload.attachment } : {}),
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };
    supportRequests.push(supportRequest);

    // TODO: Send email notification to support@trustlessoss.com
    // In production, integrate with email service (SendGrid, Resend, etc.)
    console.log('Support request received:', supportRequest);

    return NextResponse.json(
      { message: 'Support request received successfully', id: supportRequest.id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Support request error:', error);
    return NextResponse.json({ error: 'Failed to process support request' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ requests: supportRequests });
}
