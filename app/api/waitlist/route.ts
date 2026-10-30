import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 120;
const MAX_FEEDBACK_LEN = 1000;

// In-memory fallback when WAITLIST_GOOGLE_SHEET_URL is unset (see .env).
const waitlist: { email: string; date: string; name?: string; feedback?: string }[] = [];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  // The loose email regex would still allow markup, so block <, >, " explicitly.
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email) || /["<>]/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // name/feedback are optional: non-string/empty is treated as "not provided".
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (name && (name.length > MAX_NAME_LEN || /[<>]/.test(name))) {
    return NextResponse.json(
      { error: 'Name is too long or contains invalid characters.' },
      { status: 400 }
    );
  }
  const feedback = typeof payload.feedback === 'string' ? payload.feedback.trim() : '';
  if (feedback && (feedback.length > MAX_FEEDBACK_LEN || /[<>]/.test(feedback))) {
    return NextResponse.json(
      { error: 'Your message is too long or contains invalid characters.' },
      { status: 400 }
    );
  }

  const record = {
    email,
    date: new Date().toISOString(),
    ...(name ? { name } : {}),
    ...(feedback ? { feedback } : {}),
  };

  // No sheet configured -> keep in memory (dev only; resets on server restart).
  const sheetUrl = process.env.WAITLIST_GOOGLE_SHEET_URL;
  if (!sheetUrl) {
    waitlist.push(record);
    return NextResponse.json({ message: 'Added to waitlist' }, { status: 200 });
  }

  try {
    const res = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: string }
      | null;
    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { error: data?.error ?? 'Could not save to the waitlist. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: 'Added to waitlist' }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'The waitlist service is unavailable. Please try again.' },
      { status: 502 }
    );
  }
}
