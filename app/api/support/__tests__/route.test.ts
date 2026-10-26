import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

describe('support route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the current form payload without removed identity fields', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const request = new NextRequest('http://localhost:3000/api/support', {
      method: 'POST',
      body: JSON.stringify({
        category: 'general',
        subject: 'Help with a bounty',
        message: 'I need help setting up a bounty.',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Support request received successfully',
      id: expect.any(String),
    });
  });

  it('accepts an optional image or video data URL attachment', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const request = new NextRequest('http://localhost:3000/api/support', {
      method: 'POST',
      body: JSON.stringify({
        category: 'general',
        subject: 'Help with a bounty',
        message: 'I need help setting up a bounty.',
        attachment: 'data:image/png;base64,aGVsbG8=',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('rejects categories that are not offered by the form', async () => {
    const request = new NextRequest('http://localhost:3000/api/support', {
      method: 'POST',
      body: JSON.stringify({
        category: 'genreal',
        subject: 'Help',
        message: 'Please help.',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing or invalid support request fields',
    });
  });
});
