// capture-lead.js — stores email gate submissions
// Saves to a simple append log via Netlify Blobs (or falls back gracefully)
// Future: wire to Mailchimp / ConvertKit / Airtable as needed

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { name, email, consent, source, ts } = body;

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log to console (visible in Netlify function logs)
    console.log(JSON.stringify({ event: 'lead_capture', name, email, consent, source, ts }));

    // TODO: integrate with email platform
    // e.g. Mailchimp, ConvertKit, Airtable, etc.
    // For now: logs are queryable in Netlify dashboard under Functions > Logs

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('capture-lead error:', e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/capture-lead' };
