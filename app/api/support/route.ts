import { NextRequest, NextResponse } from 'next/server';

interface SupportRequest {
  name: string;
  email: string;
  githubUsername: string;
  companyOrProject?: string;
  subject: string;
  category: string;
  message: string;
  attachment?: string;
}

// In-memory storage (replace with database in production)
const supportRequests: SupportRequest[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupportRequest;

    if (
      !body.name ||
      !body.email ||
      !body.githubUsername ||
      !body.subject ||
      !body.message ||
      !body.category
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (body.githubUsername.trim().length === 0) {
      return NextResponse.json({ error: 'GitHub username is required' }, { status: 400 });
    }

    // Store the request (in production, save to database)
    const supportRequest = {
      ...body,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substring(7),
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
