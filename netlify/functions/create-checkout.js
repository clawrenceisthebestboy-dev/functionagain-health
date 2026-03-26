'use strict';

const https = require('https');

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(body).toString();
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(qs), 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { labs, tier = 'premium' } = JSON.parse(event.body || '{}');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.URL || 'https://functionagain-health.netlify.app';

  // ── DEMO MODE: bypass Stripe, redirect directly to report ─────────────────
  if (!stripeKey || stripeKey.includes('demo_mode')) {
    const demoUrl = `${siteUrl}/bloodwork-quiz.html?session_id=demo_${Date.now()}&tier=${tier}&labs=${encodeURIComponent(JSON.stringify(labs))}`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: demoUrl }),
    };
  }

  const TIERS = {
    basic:   { price: 2900,  name: 'Functional Blood Analysis — Basic',   desc: 'Full marker analysis, pattern detection, priority action plan. Instant delivery.' },
    premium: { price: 4999,  name: 'Functional Blood Analysis — Premium', desc: 'Extended AI analysis + supplement recommendations + PDF report. Instant delivery.' },
    consult: { price: 14900, name: 'Consultation + Premium Report',        desc: '1-hour phone call with Sara Knight + full premium AI report + 7-day email follow-up.' },
  };

  const t = TIERS[tier] || TIERS.premium;

  const session = await post('api.stripe.com', '/v1/checkout/sessions', {
    Authorization: `Bearer ${stripeKey}`,
  }, {
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(t.price),
    'line_items[0][price_data][product_data][name]': t.name,
    'line_items[0][price_data][product_data][description]': t.desc,
    'line_items[0][quantity]': '1',
    mode: 'payment',
    'success_url': `${siteUrl}/bloodwork-quiz.html?session_id={CHECKOUT_SESSION_ID}&tier=${tier}&labs=${encodeURIComponent(JSON.stringify(labs))}`,
    'cancel_url': `${siteUrl}/bloodwork-quiz.html`,
    'payment_intent_data[description]': `Function Again Health — ${t.name}`,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ url: session.url }),
  };
};
