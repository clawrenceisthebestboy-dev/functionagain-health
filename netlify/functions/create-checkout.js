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

  const { labs } = JSON.parse(event.body || '{}');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.URL || 'https://functionagain-health.netlify.app';

  const session = await post('api.stripe.com', '/v1/checkout/sessions', {
    Authorization: `Bearer ${stripeKey}`,
  }, {
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': '2900',
    'line_items[0][price_data][product_data][name]': 'Functional Blood Chemistry Report',
    'line_items[0][price_data][product_data][description]': 'AI-powered functional analysis of your bloodwork using Weatherby methodology',
    'line_items[0][quantity]': '1',
    mode: 'payment',
    'success_url': `${siteUrl}/bloodwork-quiz.html?session_id={CHECKOUT_SESSION_ID}&labs=${encodeURIComponent(JSON.stringify(labs))}`,
    'cancel_url': `${siteUrl}/bloodwork-quiz.html`,
    'payment_intent_data[description]': 'Function Again Health — Functional Blood Analysis',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ url: session.url }),
  };
};
