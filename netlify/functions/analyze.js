'use strict';

// Netlify serverless function — receives lab values + payment session ID
// Verifies Stripe payment → calls Anthropic → returns full AI analysis

const https = require('https');

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: 'parse error', raw: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on('error', reject);
  });
}

// ── Functional Medicine Optimal Ranges ──────────────────────────────────────────────
const FUNCTIONAL_RANGES = {
  glucose:        { name: 'Fasting Glucose',     unit: 'mg/dL', lo: 75, hi: 86 },
  hba1c:          { name: 'HbA1c',               unit: '%',     lo: 4.8, hi: 5.3 },
  insulin:        { name: 'Fasting Insulin',      unit: 'μIU/mL',lo: 2, hi: 8 },
  triglycerides:  { name: 'Triglycerides',        unit: 'mg/dL', lo: 60, hi: 100 },
  total_chol:     { name: 'Total Cholesterol',    unit: 'mg/dL', lo: 160, hi: 220 },
  ldl:            { name: 'LDL',                  unit: 'mg/dL', lo: 80, hi: 120 },
  hdl:            { name: 'HDL',                  unit: 'mg/dL', lo: 55, hi: 75 },
  tsh:            { name: 'TSH',                  unit: 'mIU/L', lo: 1.0, hi: 2.0 },
  free_t3:        { name: 'Free T3',              unit: 'pg/mL', lo: 3.0, hi: 3.5 },
  free_t4:        { name: 'Free T4',              unit: 'ng/dL', lo: 1.0, hi: 1.5 },
  ferritin:       { name: 'Ferritin',             unit: 'ng/mL', lo: 50, hi: 150 },
  serum_iron:     { name: 'Serum Iron',           unit: 'μg/dL', lo: 85, hi: 130 },
  tibc:           { name: 'TIBC',                 unit: 'μg/dL', lo: 250, hi: 370 },
  vitamin_d:      { name: 'Vitamin D (25-OH)',    unit: 'ng/mL', lo: 50, hi: 80 },
  b12:            { name: 'Vitamin B12',          unit: 'pg/mL', lo: 450, hi: 900 },
  homocysteine:   { name: 'Homocysteine',         unit: 'μmol/L',lo: 5, hi: 8 },
  hscrp:          { name: 'hsCRP',               unit: 'mg/L',  lo: 0, hi: 1.0 },
  wbc:            { name: 'WBC',                  unit: '10³/μL',lo: 5.5, hi: 7.5 },
  rbc:            { name: 'RBC',                  unit: 'M/μL',  lo: 4.2, hi: 4.9 },
  hemoglobin:     { name: 'Hemoglobin',           unit: 'g/dL',  lo: 13.5, hi: 15.0 },
  hematocrit:     { name: 'Hematocrit',           unit: '%',     lo: 40, hi: 47 },
  mcv:            { name: 'MCV',                  unit: 'fL',    lo: 85, hi: 95 },
  mch:            { name: 'MCH',                  unit: 'pg',    lo: 27, hi: 31.9 },
  mchc:           { name: 'MCHC',                 unit: 'g/dL',  lo: 32, hi: 35 },
  rdw:            { name: 'RDW',                  unit: '%',     lo: 11.5, hi: 13.0 },
  platelets:      { name: 'Platelets',            unit: '10³/μL',lo: 175, hi: 350 },
  bun:            { name: 'BUN',                  unit: 'mg/dL', lo: 13, hi: 18 },
  creatinine:     { name: 'Creatinine',           unit: 'mg/dL', lo: 0.8, hi: 1.1 },
  sodium:         { name: 'Sodium',               unit: 'mEq/L', lo: 135, hi: 142 },
  potassium:      { name: 'Potassium',            unit: 'mEq/L', lo: 4.0, hi: 4.5 },
  chloride:       { name: 'Chloride',             unit: 'mEq/L', lo: 100, hi: 106 },
  co2:            { name: 'CO2 (Bicarbonate)',    unit: 'mEq/L', lo: 25, hi: 30 },
  albumin:        { name: 'Albumin',              unit: 'g/dL',  lo: 4.0, hi: 5.0 },
  total_protein:  { name: 'Total Protein',        unit: 'g/dL',  lo: 6.9, hi: 7.4 },
  globulin:       { name: 'Globulin',             unit: 'g/dL',  lo: 2.4, hi: 2.8 },
  calcium:        { name: 'Calcium',              unit: 'mg/dL', lo: 9.2, hi: 10.1 },
  phosphorus:     { name: 'Phosphorus',           unit: 'mg/dL', lo: 3.0, hi: 4.0 },
  magnesium:      { name: 'Magnesium',            unit: 'mg/dL', lo: 2.0, hi: 2.5 },
  uric_acid:      { name: 'Uric Acid',            unit: 'mg/dL', lo: 3.5, hi: 5.9 },
  alt:            { name: 'ALT',                  unit: 'U/L',   lo: 10, hi: 26 },
  ast:            { name: 'AST',                  unit: 'U/L',   lo: 10, hi: 26 },
  alk_phos:       { name: 'Alkaline Phosphatase', unit: 'U/L',   lo: 70, hi: 100 },
  ggt:            { name: 'GGT',                  unit: 'U/L',   lo: 10, hi: 26 },
  ldh:            { name: 'LDH',                  unit: 'U/L',   lo: 140, hi: 200 },
  bilirubin:      { name: 'Total Bilirubin',      unit: 'mg/dL', lo: 0.2, hi: 0.9 },
  cortisol:       { name: 'Cortisol (AM)',        unit: 'μg/dL', lo: 10, hi: 18 },
  dheas:          { name: 'DHEA-S',               unit: 'μg/dL', lo: 150, hi: 380 },
  testosterone_m: { name: 'Testosterone (Male)',  unit: 'ng/dL', lo: 500, hi: 900 },
  testosterone_f: { name: 'Testosterone (Female)',unit: 'ng/dL', lo: 25, hi: 70 },
  estradiol:      { name: 'Estradiol (E2)',        unit: 'pg/mL', lo: 60, hi: 150 },
  progesterone:   { name: 'Progesterone',         unit: 'ng/mL', lo: 5, hi: 25 },
  shbg:           { name: 'SHBG',                 unit: 'nmol/L',lo: 25, hi: 55 },
  igf1:           { name: 'IGF-1',                unit: 'ng/mL', lo: 150, hi: 300 },
};

// ── Pattern Detection ─────────────────────────────────────────────
function detectPatterns(labs) {
  const patterns = [];
  const hi = (key, thresh) => labs[key] !== undefined && labs[key] > thresh;
  const lo = (key, thresh) => labs[key] !== undefined && labs[key] < thresh;
  const has = (key) => labs[key] !== undefined;

  // Metabolic Syndrome / Syndrome X
  let metScore = 0;
  if (hi('glucose', 100)) metScore++;
  if (hi('hba1c', 5.7)) metScore++;
  if (hi('triglycerides', 110)) metScore++;
  if (hi('total_chol', 220)) metScore++;
  if (lo('hdl', 50)) metScore++;
  if (hi('insulin', 10)) metScore++;
  if (metScore >= 3) patterns.push({ name: 'Metabolic Syndrome / Syndrome X', confidence: Math.min(metScore * 18, 95), markers: ['glucose', 'hba1c', 'triglycerides', 'hdl', 'insulin'] });

  // Iron Deficiency Anemia
  let ironScore = 0;
  if (lo('ferritin', 50)) ironScore++;
  if (lo('serum_iron', 85)) ironScore++;
  if (hi('tibc', 350)) ironScore++;
  if (lo('mcv', 85)) ironScore++;
  if (lo('mch', 27)) ironScore++;
  if (lo('hemoglobin', 13)) ironScore++;
  if (ironScore >= 2) patterns.push({ name: 'Iron Deficiency Pattern', confidence: Math.min(ironScore * 16, 95), markers: ['ferritin', 'serum_iron', 'tibc', 'mcv', 'mch'] });

  // B12/Folate Deficiency
  let b12Score = 0;
  if (hi('mcv', 89.9)) b12Score++;
  if (hi('mch', 31.9)) b12Score++;
  if (hi('rdw', 13)) b12Score++;
  if (hi('ldh', 200)) b12Score++;
  if (has('b12') && lo('b12', 450)) b12Score++;
  if (hi('homocysteine', 10)) b12Score++;
  if (b12Score >= 2) patterns.push({ name: 'B12/Folate Deficiency Pattern', confidence: Math.min(b12Score * 16, 95), markers: ['mcv', 'mch', 'rdw', 'ldh', 'b12', 'homocysteine'] });

  // Hypothyroid Pattern
  let thyScore = 0;
  if (hi('tsh', 2.0)) thyScore++;
  if (lo('free_t3', 3.0)) thyScore++;
  if (lo('free_t4', 1.0)) thyScore++;
  if (hi('triglycerides', 110)) thyScore++;
  if (hi('total_chol', 220)) thyScore++;
  if (thyScore >= 2) patterns.push({ name: 'Hypothyroid Pattern', confidence: Math.min(thyScore * 20, 95), markers: ['tsh', 'free_t3', 'free_t4', 'triglycerides', 'total_chol'] });

  // Fatty Liver Pattern
  let liverScore = 0;
  if (hi('alt', 30)) liverScore++;
  if (hi('ggt', 30)) liverScore++;
  if (hi('ldh', 200)) liverScore++;
  if (hi('alk_phos', 100)) liverScore++;
  if (hi('glucose', 100)) liverScore++;
  if (hi('triglycerides', 110)) liverScore++;
  if (liverScore >= 3) patterns.push({ name: 'Fatty Liver Pattern', confidence: Math.min(liverScore * 16, 95), markers: ['alt', 'ggt', 'ldh', 'triglycerides'] });

  // Adrenal Dysfunction
  let adrenalScore = 0;
  if (lo('cortisol', 10) || hi('cortisol', 18)) adrenalScore++;
  if (lo('dheas', 150)) adrenalScore++;
  if (hi('sodium', 142) || lo('sodium', 135)) adrenalScore++;
  if (hi('potassium', 4.5) || lo('potassium', 4.0)) adrenalScore++;
  if (adrenalScore >= 2) patterns.push({ name: 'Adrenal Dysfunction Pattern', confidence: Math.min(adrenalScore * 22, 95), markers: ['cortisol', 'dheas', 'sodium', 'potassium'] });

  // Inflammatory Pattern
  let infScore = 0;
  if (hi('hscrp', 1.0)) infScore++;
  if (hi('wbc', 7.5)) infScore++;
  if (hi('homocysteine', 9)) infScore++;
  if (hi('ldh', 200)) infScore++;
  if (hi('uric_acid', 5.9)) infScore++;
  if (infScore >= 2) patterns.push({ name: 'Chronic Inflammation Pattern', confidence: Math.min(infScore * 20, 95), markers: ['hscrp', 'wbc', 'homocysteine', 'uric_acid'] });

  // Insulin Resistance
  let irScore = 0;
  if (hi('insulin', 8)) irScore++;
  if (hi('glucose', 90)) irScore++;
  if (hi('hba1c', 5.4)) irScore++;
  if (lo('hdl', 55)) irScore++;
  if (hi('triglycerides', 100)) irScore++;
  if (lo('shbg', 25)) irScore++;
  if (irScore >= 3) patterns.push({ name: 'Insulin Resistance Pattern', confidence: Math.min(irScore * 16, 95), markers: ['insulin', 'glucose', 'hba1c', 'hdl', 'triglycerides', 'shbg'] });

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

// ── Build context for AI ──────────────────────────────────────────────────────
function buildLabContext(labs) {
  const flags = [];
  for (const [key, val] of Object.entries(labs)) {
    const range = FUNCTIONAL_RANGES[key];
    if (!range || val === undefined || val === null || val === '') continue;
    const v = parseFloat(val);
    if (isNaN(v)) continue;
    let status = 'OPTIMAL';
    if (v < range.lo) status = v < range.lo * 0.9 ? 'LOW' : 'LOW-CAUTION';
    if (v > range.hi) status = v > range.hi * 1.1 ? 'HIGH' : 'HIGH-CAUTION';
    flags.push(`${range.name}: ${v} ${range.unit} [${status} — functional range ${range.lo}–${range.hi}]`);
  }
  return flags.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { labs, sessionId, email } = JSON.parse(event.body || '{}');
  if (!labs || !sessionId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing labs or sessionId' }) };

  // ── Verify Stripe payment (skip in demo mode) ────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const isDemoMode = !stripeKey || stripeKey.includes('demo_mode') || sessionId.startsWith('demo_');

  if (!isDemoMode) {
    if (!stripeKey) return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
    const session = await get('api.stripe.com', `/v1/checkout/sessions/${sessionId}`, {
      Authorization: `Bearer ${stripeKey}`,
    });
    if (session.payment_status !== 'paid') {
      return { statusCode: 402, body: JSON.stringify({ error: 'Payment not confirmed' }) };
    }
  }

  // ── Detect patterns ───────────────────────────────────────────────────────
  const labContext = buildLabContext(labs);
  const patterns = detectPatterns(labs);
  const patternContext = patterns.length > 0
    ? patterns.map(p => `${p.name} (${p.confidence}% confidence)`).join('\n')
    : 'No strong patterns detected with available data';

  // ── Call Anthropic ────────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY_SARA;
  if (!anthropicKey) return { statusCode: 500, body: JSON.stringify({ error: 'AI not configured' }) };

  const prompt = `You are a functional medicine practitioner trained in Weatherby & Ferguson's Blood Chemistry and CBC Analysis methodology. You are reviewing a patient's lab results and generating a comprehensive functional health report.

PATIENT LAB VALUES (with functional status):
${labContext}

PATTERN ANALYSIS:
${patternContext}

Generate a comprehensive, professional functional blood chemistry report with these sections:

1. **EXECUTIVE SUMMARY** — 2-3 sentences on the overall picture. What stands out most?

2. **DETAILED MARKER ANALYSIS** — For each flagged marker, explain: what it means functionally, what symptoms this commonly causes, what it could be driving in their body, and what typically helps correct it. Be specific and educational. Use plain English — no jargon without explanation.

3. **PATTERN ANALYSIS** — Explain any detected patterns (e.g., Metabolic Syndrome, Hypothyroid Pattern, Iron Deficiency) in depth. How do these markers connect to each other? What is the body trying to tell us?

4. **PRIORITY ACTION PLAN** — Ranked list of the top 5-7 things worth addressing, in order of importance. For each: the concern, why it matters, and general direction (diet, lifestyle, supplement category, testing follow-up). Do NOT prescribe specific medications or dosages.

5. **RECOMMENDED FOLLOW-UP LABS** — What additional tests would complete this picture? Why?

6. **POSITIVE FINDINGS** — Acknowledge what looks good. Most people focus on problems; tell them what their body is doing right.

Be warm, clear, and empowering. This person is taking charge of their health. Acknowledge that. Be as thorough as the data allows. Length should match the number of flagged markers — a complete panel warrants a complete report.

IMPORTANT: End with: "This report is for educational purposes only and does not constitute medical advice. Please discuss findings with your licensed healthcare provider."`;

  const aiResponse = await post('api.anthropic.com', '/v1/messages',
    {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    {
      model: 'claude-haiku-4-5',  // Fast model for Netlify free tier (10s timeout). Upgrade to sonnet-4-6 with Netlify Pro.
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }
  );

  const reportText = aiResponse?.content?.[0]?.text || 'Report generation failed.';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      report: reportText,
      patterns,
      flaggedCount: (labContext.match(/\bLOW\b|\bHIGH\b/g) || []).length,
    }),
  };
};
