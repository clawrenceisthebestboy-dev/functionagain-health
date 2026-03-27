'use strict';

/**
 * generate-report.js
 * Rule-based functional blood chemistry analysis engine.
 * Built by AI, runs without AI. Zero marginal cost per report.
 * 
 * Flow: receive labs → analyze → generate HTML report → email via Resend
 */

// ── FUNCTIONAL OPTIMAL RANGES ────────────────────────────────────────────────
const RANGES = {
  // Blood Sugar & Metabolism
  glucose:        { name: 'Fasting Glucose',          unit: 'mg/dL',  lo: 75,   hi: 86,   cat: 'Metabolism' },
  hba1c:          { name: 'HbA1c',                    unit: '%',      lo: 4.8,  hi: 5.3,  cat: 'Metabolism' },
  insulin:        { name: 'Fasting Insulin',           unit: 'μIU/mL', lo: 2,    hi: 8,    cat: 'Metabolism' },
  // Lipids
  triglycerides:  { name: 'Triglycerides',             unit: 'mg/dL',  lo: 60,   hi: 100,  cat: 'Lipids' },
  total_chol:     { name: 'Total Cholesterol',         unit: 'mg/dL',  lo: 160,  hi: 220,  cat: 'Lipids' },
  ldl:            { name: 'LDL Cholesterol',           unit: 'mg/dL',  lo: 80,   hi: 120,  cat: 'Lipids' },
  hdl:            { name: 'HDL Cholesterol',           unit: 'mg/dL',  lo: 55,   hi: 75,   cat: 'Lipids' },
  // Thyroid
  tsh:            { name: 'TSH',                       unit: 'mIU/L',  lo: 1.0,  hi: 2.0,  cat: 'Thyroid' },
  free_t3:        { name: 'Free T3',                   unit: 'pg/mL',  lo: 3.0,  hi: 3.5,  cat: 'Thyroid' },
  free_t4:        { name: 'Free T4',                   unit: 'ng/dL',  lo: 1.0,  hi: 1.5,  cat: 'Thyroid' },
  // Iron & Nutrients
  ferritin:       { name: 'Ferritin',                  unit: 'ng/mL',  lo: 50,   hi: 150,  cat: 'Iron & Nutrients' },
  serum_iron:     { name: 'Serum Iron',                unit: 'μg/dL',  lo: 85,   hi: 130,  cat: 'Iron & Nutrients' },
  tibc:           { name: 'TIBC',                      unit: 'μg/dL',  lo: 250,  hi: 350,  cat: 'Iron & Nutrients' },
  vitamin_d:      { name: 'Vitamin D (25-OH)',          unit: 'ng/mL',  lo: 50,   hi: 80,   cat: 'Iron & Nutrients' },
  b12:            { name: 'Vitamin B12',               unit: 'pg/mL',  lo: 450,  hi: 900,  cat: 'Iron & Nutrients' },
  // Inflammation
  homocysteine:   { name: 'Homocysteine',              unit: 'μmol/L', lo: 5,    hi: 8,    cat: 'Inflammation' },
  hscrp:          { name: 'hsCRP',                     unit: 'mg/L',   lo: 0,    hi: 1.0,  cat: 'Inflammation' },
  esr:            { name: 'ESR',                       unit: 'mm/hr',  lo: 0,    hi: 10,   cat: 'Inflammation' },
  uric_acid:      { name: 'Uric Acid',                 unit: 'mg/dL',  lo: 3.5,  hi: 5.9,  cat: 'Inflammation' },
  // CBC
  wbc:            { name: 'White Blood Cells',         unit: '10³/μL', lo: 5.5,  hi: 7.5,  cat: 'CBC' },
  rbc:            { name: 'Red Blood Cells',           unit: 'M/μL',   lo: 4.2,  hi: 4.9,  cat: 'CBC' },
  hemoglobin:     { name: 'Hemoglobin',                unit: 'g/dL',   lo: 13.5, hi: 15.0, cat: 'CBC' },
  hematocrit:     { name: 'Hematocrit',                unit: '%',      lo: 40,   hi: 47,   cat: 'CBC' },
  mcv:            { name: 'MCV',                       unit: 'fL',     lo: 85,   hi: 95,   cat: 'CBC' },
  mch:            { name: 'MCH',                       unit: 'pg',     lo: 27,   hi: 31.9, cat: 'CBC' },
  mchc:           { name: 'MCHC',                      unit: 'g/dL',   lo: 32,   hi: 35,   cat: 'CBC' },
  rdw:            { name: 'RDW',                       unit: '%',      lo: 11.5, hi: 13.0, cat: 'CBC' },
  platelets:      { name: 'Platelets',                 unit: '10³/μL', lo: 175,  hi: 350,  cat: 'CBC' },
  // Metabolic Panel
  bun:            { name: 'BUN',                       unit: 'mg/dL',  lo: 13,   hi: 18,   cat: 'Metabolic' },
  creatinine:     { name: 'Creatinine',                unit: 'mg/dL',  lo: 0.8,  hi: 1.1,  cat: 'Metabolic' },
  sodium:         { name: 'Sodium',                    unit: 'mEq/L',  lo: 135,  hi: 142,  cat: 'Metabolic' },
  potassium:      { name: 'Potassium',                 unit: 'mEq/L',  lo: 4.0,  hi: 4.5,  cat: 'Metabolic' },
  chloride:       { name: 'Chloride',                  unit: 'mEq/L',  lo: 100,  hi: 106,  cat: 'Metabolic' },
  co2:            { name: 'CO2 (Bicarbonate)',          unit: 'mEq/L',  lo: 25,   hi: 30,   cat: 'Metabolic' },
  albumin:        { name: 'Albumin',                   unit: 'g/dL',   lo: 4.0,  hi: 5.0,  cat: 'Metabolic' },
  total_protein:  { name: 'Total Protein',             unit: 'g/dL',   lo: 6.9,  hi: 7.4,  cat: 'Metabolic' },
  globulin:       { name: 'Globulin',                  unit: 'g/dL',   lo: 2.4,  hi: 2.8,  cat: 'Metabolic' },
  calcium:        { name: 'Calcium',                   unit: 'mg/dL',  lo: 9.2,  hi: 10.1, cat: 'Metabolic' },
  phosphorus:     { name: 'Phosphorus',                unit: 'mg/dL',  lo: 3.0,  hi: 4.0,  cat: 'Metabolic' },
  magnesium:      { name: 'Magnesium',                 unit: 'mg/dL',  lo: 2.0,  hi: 2.5,  cat: 'Metabolic' },
  // Liver
  alt:            { name: 'ALT',                       unit: 'U/L',    lo: 10,   hi: 26,   cat: 'Liver' },
  ast:            { name: 'AST',                       unit: 'U/L',    lo: 10,   hi: 26,   cat: 'Liver' },
  alk_phos:       { name: 'Alkaline Phosphatase',      unit: 'U/L',    lo: 70,   hi: 100,  cat: 'Liver' },
  ggt:            { name: 'GGT',                       unit: 'U/L',    lo: 10,   hi: 26,   cat: 'Liver' },
  ldh:            { name: 'LDH',                       unit: 'U/L',    lo: 140,  hi: 200,  cat: 'Liver' },
  bilirubin:      { name: 'Total Bilirubin',           unit: 'mg/dL',  lo: 0.2,  hi: 0.9,  cat: 'Liver' },
  // Hormones
  cortisol:       { name: 'Cortisol (AM)',             unit: 'μg/dL',  lo: 10,   hi: 18,   cat: 'Hormones' },
  dheas:          { name: 'DHEA-S',                    unit: 'μg/dL',  lo: 150,  hi: 380,  cat: 'Hormones' },
  testosterone_m: { name: 'Testosterone (Male)',       unit: 'ng/dL',  lo: 500,  hi: 900,  cat: 'Hormones' },
  testosterone_f: { name: 'Testosterone (Female)',     unit: 'ng/dL',  lo: 25,   hi: 70,   cat: 'Hormones' },
  estradiol:      { name: 'Estradiol (E2)',            unit: 'pg/mL',  lo: 60,   hi: 150,  cat: 'Hormones' },
  progesterone:   { name: 'Progesterone',              unit: 'ng/mL',  lo: 5,    hi: 25,   cat: 'Hormones' },
  shbg:           { name: 'SHBG',                      unit: 'nmol/L', lo: 25,   hi: 55,   cat: 'Hormones' },
  igf1:           { name: 'IGF-1',                     unit: 'ng/mL',  lo: 150,  hi: 300,  cat: 'Hormones' },
  lh:             { name: 'LH',                        unit: 'mIU/mL', lo: 2,    hi: 8,    cat: 'Hormones' },
  fsh:            { name: 'FSH',                       unit: 'mIU/mL', lo: 2,    hi: 9,    cat: 'Hormones' },
  prolactin:      { name: 'Prolactin',                 unit: 'ng/mL',  lo: 3,    hi: 15,   cat: 'Hormones' },
};

// ── MARKER EXPLANATIONS ───────────────────────────────────────────────────────
const EXPLANATIONS = {
  glucose: {
    low:     'Low fasting glucose can suggest reactive hypoglycemia, adrenal fatigue, or poor glycogen storage. Common symptoms: fatigue between meals, shakiness, anxiety, difficulty concentrating.',
    high:    'Fasting glucose above the functional optimal range is an early warning of blood sugar dysregulation — often present years before a diabetes diagnosis. Common causes: high refined carbohydrate intake, insulin resistance, stress, poor sleep. Symptoms: energy crashes, sugar cravings, brain fog, difficulty losing weight.',
    optimal: 'Excellent fasting glucose — strong insulin sensitivity and blood sugar regulation.',
    fix_high: 'Reduce refined carbohydrates and sugar. Prioritize protein and fat at meals. Walk after eating. Consider magnesium and berberine. Wear a CGM for 30 days to see your personal food responses.',
    fix_low:  'Eat regular meals with adequate protein. Address adrenal stress. Check cortisol levels.',
  },
  hba1c: {
    low:     'Very low HbA1c can occasionally indicate certain anemias affecting test accuracy.',
    high:    'HbA1c above functional optimal (5.3%) indicates chronic blood sugar elevation. This measure reflects your 3-month average — meaning the issue has been building for months. Standard medicine flags prediabetes at 5.7%, by which point significant cellular damage has occurred.',
    optimal: 'HbA1c is in excellent range — blood sugar has been well-controlled over the past 3 months.',
    fix_high: 'Same protocol as elevated glucose. HbA1c responds to dietary changes within 3 months. Reduce sugar, refined grains, alcohol. Increase fiber, protein, resistance exercise.',
  },
  insulin: {
    low:     'Very low fasting insulin is generally positive, indicating good insulin sensitivity.',
    high:    'Elevated fasting insulin is the earliest detectable sign of insulin resistance — often present a decade before glucose rises. This is the single most under-ordered and under-interpreted metabolic marker. Even at 9-12 μIU/mL (within "normal" standard range), insulin resistance is developing.',
    optimal: 'Fasting insulin is in excellent range — strong insulin sensitivity.',
    fix_high: 'Time-restricted eating (12-16 hour fasting window). Remove liquid sugar. Prioritize protein. Resistance training 3x/week. Consider berberine, chromium, alpha-lipoic acid.',
  },
  triglycerides: {
    low:     'Very low triglycerides are generally positive — often seen with low carbohydrate intake.',
    high:    'Elevated triglycerides are a primary metabolic warning signal — one of the best predictors of insulin resistance and cardiovascular risk. Even levels of 101-150 mg/dL (standard "normal") are functionally significant. Main driver: excess carbohydrate and sugar intake.',
    optimal: 'Triglycerides are in excellent functional range — good metabolic health indicator.',
    fix_high: 'Dramatically reduce sugar, alcohol, and refined carbohydrates. Increase omega-3 fatty acids (fish oil). Exercise regularly. Address underlying insulin resistance.',
  },
  hdl: {
    low:     'Low HDL is one of the strongest independent cardiovascular risk factors. HDL removes cholesterol from vessel walls — when it\'s low, plaque accumulates. Key drivers: sedentary lifestyle, high refined carbs, smoking, insulin resistance.',
    high:    'Very high HDL (above 80) can paradoxically carry risk in some cases — worth monitoring but rarely requires intervention.',
    optimal: 'HDL is in excellent functional range — strong cardiovascular protective factor.',
    fix_low:  'Exercise (raises HDL most effectively). Reduce refined carbohydrates. Increase healthy fats (olive oil, avocado, nuts). Quit smoking. Address insulin resistance.',
  },
  tsh: {
    low:     'TSH below 1.0 can indicate thyroid overactivity or over-supplementation. Symptoms: anxiety, heart palpitations, insomnia, heat intolerance, unexplained weight loss.',
    high:    'TSH above 2.0 functionally indicates the thyroid is being overdriven to maintain output — a sign of early hypothyroid. Standard labs won\'t flag this until 4.5. This gap represents years of missed subclinical hypothyroidism. Classic symptoms: fatigue, weight gain, cold hands and feet, hair thinning, brain fog, constipation, depression.',
    optimal: 'TSH is in the functional sweet spot — thyroid is working efficiently.',
    fix_high: 'Check Free T3 and Free T4 if not already done. Check for selenium and iodine deficiency. Address underlying inflammation. Discuss with a functional medicine practitioner.',
  },
  free_t3: {
    low:     'Low Free T3 is the most functionally significant thyroid finding. T3 is the active form that enters cells and drives metabolism. Low T3 with normal TSH is extremely common and almost always missed by standard medicine. Causes: poor T4-to-T3 conversion, selenium deficiency, inflammation, high cortisol, gut dysfunction.',
    high:    'High Free T3 suggests hyperthyroidism or over-supplementation.',
    optimal: 'Free T3 is optimal — active thyroid hormone is well-supplied to cells.',
    fix_low:  'Check selenium status. Reduce chronic stress (cortisol blocks T3 conversion). Address gut health. Ask doctor about combination T4/T3 therapy vs T4 only.',
  },
  free_t4: {
    low:     'Low Free T4 indicates the thyroid isn\'t producing enough precursor hormone.',
    high:    'High Free T4 with low T3 suggests conversion impairment — T4 building up because it\'s not being converted to the active T3 form.',
    optimal: 'Free T4 is in good range — adequate thyroid hormone production.',
    fix_low:  'Check iodine and selenium. Discuss with thyroid specialist.',
  },
  ferritin: {
    low:     'Low ferritin is the earliest sign of iron depletion — appearing long before anemia shows in CBC. Standard labs allow ferritin as low as 12 ng/mL, but functional deficiency begins below 50. Symptoms: persistent fatigue, hair loss (often significant), poor exercise recovery, restless legs, brain fog, cold intolerance. This is one of the most commonly missed diagnoses.',
    high:    'Elevated ferritin above 150 ng/mL can indicate iron overload, inflammation (ferritin is an acute phase reactant and rises with inflammation even without iron overload), or liver stress. Very high values (>300) require investigation.',
    optimal: 'Ferritin is in excellent functional range — iron stores are well-maintained.',
    fix_low:  'Iron-rich foods: red meat, shellfish (especially oysters), organ meats. Pair with vitamin C to enhance absorption. Avoid calcium and coffee with iron. Iron bisglycinate supplement if dietary changes insufficient. Recheck in 3 months.',
    fix_high: 'If significantly elevated, check for hemochromatosis (genetic iron overload). Reduce red meat. Address underlying inflammation.',
  },
  vitamin_d: {
    low:     'Vitamin D below 50 ng/mL is functionally deficient even if labs say "sufficient" (they\'ll call 30 ng/mL normal). Vitamin D functions as a hormone — it regulates immune function, mood, bone density, insulin sensitivity, inflammation, and autoimmune risk. Most people in northern climates are severely under-optimized. Symptoms: fatigue, low mood, frequent illness, bone pain, muscle weakness.',
    high:    'Vitamin D above 100 ng/mL warrants checking calcium levels — toxicity from excessive supplementation is possible but rare.',
    optimal: 'Vitamin D is optimally maintained — excellent for immune and hormonal support.',
    fix_low:  'Supplement with vitamin D3 + K2 (K2 directs calcium to bones, not arteries). Typical maintenance: 5,000-10,000 IU D3 daily with a meal. Recheck in 3 months. Sun exposure 20+ minutes midday when possible.',
  },
  homocysteine: {
    low:     'Very low homocysteine is generally positive.',
    high:    'Elevated homocysteine is a significant cardiovascular and neurological risk marker. It damages blood vessel walls, increases stroke risk, and is associated with cognitive decline. Standard labs allow up to 15 μmol/L — functionally, anything above 8 warrants attention. Usually caused by B12, B6, or folate deficiency, or a methylation gene variant (MTHFR).',
    optimal: 'Homocysteine is in excellent functional range — methylation and B-vitamin status looks good.',
    fix_high: 'Methylated B12 (methylcobalamin), methylated folate (5-MTHF), and B6 (P5P form). Avoid folic acid (the synthetic form). Recheck in 3 months.',
  },
  hscrp: {
    low:     'Low hsCRP is excellent — minimal systemic inflammation.',
    high:    'Elevated hsCRP indicates chronic systemic inflammation — one of the most powerful predictors of cardiovascular disease, metabolic dysfunction, autoimmune conditions, and accelerated aging. Standard reference allows up to 3 mg/L. Functional optimal is below 1.0. Common causes: poor diet, excess body fat (especially visceral), sleep deprivation, chronic stress, gut permeability, hidden infections.',
    optimal: 'hsCRP is in excellent range — inflammation appears well-controlled.',
    fix_high: 'Anti-inflammatory diet (Mediterranean pattern). Omega-3 fatty acids (3-4g EPA+DHA daily). Eliminate sugar and seed oils. Address gut health. Optimize sleep. Reduce visceral fat. Check for food sensitivities.',
  },
  cortisol: {
    low:     'Low morning cortisol is a significant finding — the cortisol awakening response is one of the body\'s most critical regulatory signals. Low AM cortisol suggests HPA axis dysfunction ("adrenal fatigue"). Symptoms: extreme difficulty waking, energy that never fully arrives, low blood pressure, salt cravings, poor stress tolerance, crashes in the afternoon.',
    high:    'High morning cortisol reflects chronic HPA axis activation. Sustained high cortisol suppresses thyroid function, breaks down muscle tissue, promotes belly fat accumulation, disrupts sleep architecture, and depletes sex hormones. Symptoms: anxiety, poor sleep, belly fat despite exercise, fatigue that worsens with stress.',
    optimal: 'Morning cortisol is in optimal range — good HPA axis function and stress response.',
    fix_low:  'Address chronic stress. Optimize sleep (most cortisol is produced during sleep). Adaptogenic herbs: ashwagandha, rhodiola. Consider 4-point cortisol saliva test for a complete picture.',
    fix_high: 'Stress reduction is non-negotiable. Prioritize 7-9 hours sleep. Phosphatidylserine (400mg) reduces cortisol. Magnesium glycinate at night. Address chronic pain or inflammation driving the response.',
  },
  dheas: {
    low:     'Low DHEA-S is one of the earliest signs of adrenal depletion and accelerated aging. DHEA is the adrenal precursor to testosterone and estrogen — when it\'s low, downstream hormone production suffers. It declines with chronic stress, poor sleep, and aging. Symptoms: fatigue, low libido, reduced resilience, low mood, loss of muscle tone.',
    high:    'Elevated DHEA-S can indicate adrenal hyperactivity or in women, PCOS or congenital adrenal hyperplasia.',
    optimal: 'DHEA-S is in healthy range — good adrenal reserve and hormonal precursor status.',
    fix_low:  'Address the root causes: chronic stress, sleep deprivation, inflammation. DHEA supplementation (25-50mg) is an option — should be done under supervision with monitoring.',
  },
  testosterone_m: {
    low:     'Low total testosterone in men is one of the most prevalent and under-addressed health issues. Standard labs allow as low as 300 ng/dL — functionally, below 500 ng/dL warrants investigation. Symptoms: fatigue, low motivation, reduced muscle mass despite training, increased body fat (especially abdominal), low libido, poor erections, brain fog, depression. Main drivers: poor sleep, high stress, insulin resistance, zinc deficiency, low vitamin D, excess alcohol, high body fat.',
    high:    'High total testosterone in men requires context — very high levels without supplementation are uncommon. May indicate adrenal issues.',
    optimal: 'Total testosterone is in excellent functional range — good androgenic hormone status.',
    fix_low:  'Optimize sleep (testosterone is produced during sleep — 1 hour less sleep reduces T by 10-15%). Reduce stress. Resistance training. Zinc (30mg), vitamin D (5000 IU), magnesium. Reduce alcohol and processed food. Lose excess body fat.',
  },
  testosterone_f: {
    low:     'Low testosterone in women is common and rarely addressed. Despite being a "male hormone," testosterone is essential for female energy, libido, muscle tone, mood, and cognitive function. Symptoms: low libido, fatigue, poor muscle tone, difficulty with motivation, mood flatness.',
    high:    'Elevated testosterone in women is associated with PCOS, insulin resistance, and adrenal overactivity. Symptoms: irregular cycles, acne, excess facial hair, mood changes. Key driver: high fasting insulin.',
    optimal: 'Female testosterone is in the functional optimal range.',
    fix_high: 'Address insulin resistance (the primary driver of high androgens in women). Reduce refined carbohydrates. Spearmint tea has evidence for reducing androgens in PCOS. Inositol supplementation.',
  },
  estradiol: {
    low:     'Low estradiol causes bone loss, vaginal dryness, poor sleep, mood instability, cardiovascular risk, and accelerated aging. Standard labs allow levels far too low for optimal function, particularly in perimenopausal women.',
    high:    'Elevated estradiol is associated with estrogen dominance — fibroids, heavy periods, mood swings, water retention, and increased breast cancer risk. In men, high estradiol causes low libido, gynecomastia, and testosterone suppression. Key driver: excess body fat (aromatase enzyme in fat cells converts testosterone to estrogen) and alcohol.',
    optimal: 'Estradiol is in functional optimal range — good estrogenic hormone status.',
    fix_high: 'Reduce body fat. Minimize alcohol. DIM (diindolylmethane) from cruciferous vegetables supports healthy estrogen metabolism. Fiber binds estrogen in the gut for elimination.',
  },
  cortisol_am: {
    low:  'See cortisol entry.',
    high: 'See cortisol entry.',
    optimal: 'Morning cortisol is in functional optimal range.',
  },
  wbc: {
    low:     'Low WBC can suggest immune suppression, chronic viral infection, nutritional deficiency (B12, folate, zinc), or bone marrow stress. Repeated low WBC warrants investigation.',
    high:    'Elevated WBC suggests active infection, inflammation, immune activation, or chronic stress response. Even trending high within "normal" warrants attention.',
    optimal: 'WBC is in functional optimal range — well-regulated immune system.',
    fix_high: 'Identify and address underlying infection or inflammation. Check CRP. Reduce stress.',
  },
  alt: {
    low:     'Very low ALT can indicate B6 deficiency.',
    high:    'Elevated ALT signals liver stress. The functional ceiling of 26 U/L is far lower than standard labs (which allow 56). ALT of 30-50 — while "normal" to your doctor — suggests early liver inflammation from diet, alcohol, medications, or beginning fatty liver.',
    optimal: 'ALT is in functional optimal range — liver appears to be handling its load well.',
    fix_high: 'Reduce alcohol, fried foods, processed food, and seed oils. Milk thistle (silymarin) supports liver regeneration. N-acetyl cysteine (NAC). Address insulin resistance. Lose excess body fat.',
  },
  ast: {
    low:     'Very low AST is rarely significant.',
    high:    'Elevated AST alongside ALT indicates liver stress. If AST significantly exceeds ALT, consider muscle damage or heart stress as an additional source.',
    optimal: 'AST is in functional optimal range.',
    fix_high: 'Same protocol as elevated ALT.',
  },
  mcv: {
    low:     'Low MCV (microcytic cells) indicates iron deficiency or, less commonly, thalassemia trait. Red cells are smaller than they should be — classic finding in iron deficiency anemia.',
    high:    'High MCV (macrocytic cells) strongly suggests B12 or folate deficiency. Cells are too large. Also seen with thyroid dysfunction, liver disease, or alcohol use.',
    optimal: 'MCV is in optimal range — red cell size looks healthy.',
    fix_low:  'Address iron deficiency (see ferritin). Check serum iron and TIBC for full picture.',
    fix_high: 'Check B12 and folate levels. Consider MTHFR gene variant. Supplement methylated B12 and methylated folate.',
  },
};

// ── PATTERN DETECTION ENGINE ──────────────────────────────────────────────────
function detectPatterns(labs) {
  const patterns = [];
  const hi  = (k, t) => labs[k] !== undefined && parseFloat(labs[k]) > t;
  const lo  = (k, t) => labs[k] !== undefined && parseFloat(labs[k]) < t;
  const has = (k)    => labs[k] !== undefined && labs[k] !== '';

  // Metabolic Syndrome
  let ms = 0;
  if (hi('glucose', 100)) ms++;
  if (hi('hba1c', 5.7))   ms++;
  if (hi('triglycerides', 110)) ms++;
  if (hi('total_chol', 220))    ms++;
  if (lo('hdl', 50))  ms++;
  if (hi('insulin', 10)) ms++;
  if (hi('uric_acid', 5.9)) ms++;
  if (ms >= 3) patterns.push({
    name: 'Metabolic Syndrome Pattern',
    confidence: Math.min(ms * 14, 95),
    description: 'Multiple markers point to metabolic dysregulation — the root of most modern chronic disease. This pattern includes blood sugar issues, lipid imbalance, and early insulin resistance. The good news: this is highly responsive to lifestyle changes.',
    priority: 1,
  });

  // Iron Deficiency
  let iron = 0;
  if (lo('ferritin', 50))    iron++;
  if (lo('serum_iron', 85))  iron++;
  if (hi('tibc', 350))       iron++;
  if (lo('mcv', 85))         iron++;
  if (lo('mch', 27))         iron++;
  if (lo('hemoglobin', 13))  iron++;
  if (lo('rdw', 11.5) || hi('rdw', 13)) iron++;
  if (iron >= 2) patterns.push({
    name: 'Iron Deficiency Pattern',
    confidence: Math.min(iron * 16, 95),
    description: 'Multiple markers indicate iron depletion — often present long before standard anemia is detected. Iron is critical for energy, oxygen transport, thyroid function, and cognitive performance. This is one of the most common and commonly missed issues.',
    priority: 2,
  });

  // B12/Folate Deficiency
  let b12p = 0;
  if (hi('mcv', 89.9))  b12p++;
  if (hi('mch', 31.9))  b12p++;
  if (hi('rdw', 13))    b12p++;
  if (hi('ldh', 200))   b12p++;
  if (has('b12') && lo('b12', 450)) b12p++;
  if (hi('homocysteine', 10)) b12p++;
  if (b12p >= 2) patterns.push({
    name: 'B12 / Folate Deficiency Pattern',
    confidence: Math.min(b12p * 16, 95),
    description: 'Several markers suggest B12 or folate insufficiency. These vitamins are essential for DNA repair, nerve function, red blood cell formation, and methylation (a critical process affecting everything from mood to cancer risk). Methylation issues are extremely common and significantly under-recognized.',
    priority: 2,
  });

  // Hypothyroid Pattern
  let thyP = 0;
  if (hi('tsh', 2.0))           thyP++;
  if (lo('free_t3', 3.0))       thyP++;
  if (lo('free_t4', 1.0))       thyP++;
  if (hi('triglycerides', 110)) thyP++;
  if (hi('total_chol', 220))    thyP++;
  if (lo('hdl', 50))            thyP++;
  if (thyP >= 2) patterns.push({
    name: 'Subclinical Hypothyroid Pattern',
    confidence: Math.min(thyP * 18, 95),
    description: 'Multiple markers are consistent with sluggish thyroid function — even if your doctor has never flagged your thyroid. The thyroid regulates metabolism, body temperature, energy, hair growth, digestion, mood, and cognitive function. Subclinical hypothyroidism is one of the most common and under-diagnosed conditions.',
    priority: 1,
  });

  // Fatty Liver Pattern
  let fatty = 0;
  if (hi('alt', 30))    fatty++;
  if (hi('ast', 26))    fatty++;
  if (hi('ggt', 30))    fatty++;
  if (hi('ldh', 200))   fatty++;
  if (hi('glucose', 100)) fatty++;
  if (hi('triglycerides', 110)) fatty++;
  if (hi('uric_acid', 5.9)) fatty++;
  if (fatty >= 3) patterns.push({
    name: 'Early Fatty Liver Pattern',
    confidence: Math.min(fatty * 14, 95),
    description: 'Several markers suggest early fatty liver (hepatic steatosis). This is the most common liver condition and is almost entirely driven by diet and metabolic factors — not alcohol. The liver is central to hormone metabolism, detoxification, and blood sugar regulation. Early intervention is highly effective.',
    priority: 1,
  });

  // Adrenal Dysfunction
  let adrenal = 0;
  if (has('cortisol') && (lo('cortisol', 10) || hi('cortisol', 18))) adrenal++;
  if (lo('dheas', 150))  adrenal++;
  if (hi('sodium', 142) || lo('sodium', 135)) adrenal++;
  if (lo('potassium', 4.0) || hi('potassium', 4.5)) adrenal++;
  if (adrenal >= 2) patterns.push({
    name: 'Adrenal Stress Pattern',
    confidence: Math.min(adrenal * 22, 95),
    description: 'Markers suggest HPA axis (adrenal) stress or dysregulation. The adrenal glands govern your stress response, energy rhythm, blood pressure, electrolyte balance, and contribute significantly to sex hormone production. Adrenal dysfunction cascades into thyroid, immune, and metabolic problems.',
    priority: 2,
  });

  // Chronic Inflammation
  let inf = 0;
  if (hi('hscrp', 1.0))       inf++;
  if (hi('wbc', 7.5))         inf++;
  if (hi('homocysteine', 9))  inf++;
  if (hi('uric_acid', 5.9))   inf++;
  if (hi('ldh', 200))         inf++;
  if (hi('esr', 10))          inf++;
  if (inf >= 2) patterns.push({
    name: 'Chronic Inflammation Pattern',
    confidence: Math.min(inf * 18, 95),
    description: 'Multiple inflammation markers are elevated. Chronic systemic inflammation is the common thread connecting cardiovascular disease, metabolic dysfunction, autoimmune conditions, cancer risk, and accelerated aging. It\'s almost always addressable through diet, sleep, and lifestyle.',
    priority: 1,
  });

  // Insulin Resistance
  let ir = 0;
  if (hi('insulin', 8))        ir++;
  if (hi('glucose', 90))       ir++;
  if (hi('hba1c', 5.4))        ir++;
  if (lo('hdl', 55))           ir++;
  if (hi('triglycerides', 100)) ir++;
  if (lo('shbg', 25))          ir++;
  if (ir >= 3) patterns.push({
    name: 'Insulin Resistance Pattern',
    confidence: Math.min(ir * 16, 95),
    description: 'Several markers suggest developing insulin resistance — the body\'s cells are becoming less responsive to insulin\'s signals. This is the root of type 2 diabetes, PCOS, fatty liver, cardiovascular disease, and hormonal dysfunction. It\'s highly reversible, especially at this stage.',
    priority: 1,
  });

  // Nutrient Depletion
  let nutr = 0;
  if (has('vitamin_d') && lo('vitamin_d', 50))  nutr++;
  if (has('b12') && lo('b12', 450))             nutr++;
  if (lo('magnesium', 2.0))                     nutr++;
  if (lo('ferritin', 50))                       nutr++;
  if (nutr >= 2) patterns.push({
    name: 'Multiple Nutrient Depletion',
    confidence: Math.min(nutr * 22, 95),
    description: 'Multiple foundational nutrients are below optimal levels. Nutrient depletion is epidemic in modern populations due to soil depletion, processed food consumption, and absorption issues. Addressing these is often the highest-leverage intervention.',
    priority: 2,
  });

  return patterns.sort((a, b) => b.confidence - a.confidence || a.priority - b.priority);
}

// ── ANALYZE ALL MARKERS ───────────────────────────────────────────────────────
function analyzeMarkers(labs) {
  const results = { flagged: [], caution: [], optimal: [], entered: 0 };

  for (const [key, range] of Object.entries(RANGES)) {
    const raw = labs[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const val = parseFloat(raw);
    if (isNaN(val)) continue;
    results.entered++;

    const { lo, hi } = range;
    const span = hi - lo;
    const cautionLo = lo - span * 0.15;
    const cautionHi = hi + span * 0.15;

    const exp = EXPLANATIONS[key] || {};
    let status, label, explanation, fix;

    if (val >= lo && val <= hi) {
      status = 'optimal';
      label = 'Optimal';
      explanation = exp.optimal || `${range.name} is within the functional optimal range.`;
    } else if (val < lo) {
      status = val < cautionLo ? 'flag' : 'caution';
      label = status === 'flag' ? 'Below Optimal' : 'Low — Watch';
      explanation = exp.low || `${range.name} is below the functional optimal range.`;
      fix = exp.fix_low;
    } else {
      status = val > cautionHi ? 'flag' : 'caution';
      label = status === 'flag' ? 'Above Optimal' : 'High — Watch';
      explanation = exp.high || `${range.name} is above the functional optimal range.`;
      fix = exp.fix_high;
    }

    const item = { key, name: range.name, val, unit: range.unit, lo, hi, status, label, explanation, fix, cat: range.cat };
    if (status === 'optimal') results.optimal.push(item);
    else if (status === 'caution') results.caution.push(item);
    else results.flagged.push(item);
  }

  return results;
}

// ── PRIORITY ACTION PLAN ─────────────────────────────────────────────────────
function buildActionPlan(flagged, caution, patterns) {
  const actions = [];

  // From patterns (highest priority)
  for (const p of patterns.slice(0, 4)) {
    if (p.name.includes('Insulin') || p.name.includes('Metabolic')) {
      actions.push('🥗 Reduce refined carbohydrates and sugar — replace with protein, fiber, and healthy fats. This is the single most impactful dietary change for your pattern.');
      actions.push('🏃 Add resistance training 3x/week and walk after meals. Movement is medicine for blood sugar and insulin sensitivity.');
    }
    if (p.name.includes('Iron')) {
      actions.push('🥩 Increase iron-rich foods (red meat, shellfish, organ meats) paired with vitamin C. Consider iron bisglycinate supplement. Recheck ferritin in 3 months.');
    }
    if (p.name.includes('Thyroid') || p.name.includes('Hypothyroid')) {
      actions.push('🦋 Request Free T3 and Free T4 testing if not already done. Check selenium status. Reduce chronic stress (cortisol impairs thyroid conversion). Discuss functional thyroid evaluation with a practitioner.');
    }
    if (p.name.includes('Inflammation')) {
      actions.push('🫒 Adopt anti-inflammatory eating: Mediterranean pattern, eliminate seed oils and processed food. Add omega-3 fatty acids (3-4g EPA+DHA daily from fish oil).');
    }
    if (p.name.includes('B12') || p.name.includes('Folate')) {
      actions.push('💊 Supplement with methylated B12 (methylcobalamin) and methylated folate (5-MTHF). Avoid synthetic folic acid. Consider MTHFR gene testing.');
    }
    if (p.name.includes('Adrenal')) {
      actions.push('😴 Prioritize sleep above all else — most adrenal recovery happens during deep sleep (7-9 hours minimum). Address the primary stressors in your life. Consider ashwagandha and rhodiola.');
    }
    if (p.name.includes('Fatty Liver')) {
      actions.push('🫀 Reduce alcohol completely for 60 days. Eliminate fried food and seed oils. Add milk thistle and NAC. Lose excess abdominal fat.');
    }
  }

  // From individual flagged markers not covered by patterns
  const coveredKeys = new Set();
  for (const f of flagged) {
    if (coveredKeys.has(f.cat)) continue;
    coveredKeys.add(f.cat);
    if (f.fix && !actions.some(a => a.includes(f.fix.slice(0, 20)))) {
      actions.push(`${f.name}: ${f.fix}`);
    }
  }

  // Always include these if not already
  const vitD = flagged.find(f => f.key === 'vitamin_d') || caution.find(f => f.key === 'vitamin_d');
  if (vitD && !actions.some(a => a.includes('Vitamin D'))) {
    actions.push('☀️ Optimize Vitamin D: supplement with D3 + K2 (5,000-10,000 IU D3 daily with a meal). Recheck in 3 months. Target 60-80 ng/mL.');
  }

  return [...new Set(actions)].slice(0, 8);
}

// ── FOLLOW-UP LABS ────────────────────────────────────────────────────────────
function recommendFollowUpLabs(labs, flagged, patterns) {
  const recs = [];
  const has = (k) => labs[k] !== undefined && labs[k] !== '';

  if (!has('insulin'))      recs.push({ test: 'Fasting Insulin', why: 'The most important missing test for anyone with any blood sugar or weight concerns. Standard panels never include it.' });
  if (!has('ferritin'))     recs.push({ test: 'Ferritin', why: 'Critical for evaluating true iron status — standard CBC alone misses early deficiency by years.' });
  if (!has('vitamin_d'))    recs.push({ test: 'Vitamin D (25-OH)', why: 'Deficiency is epidemic and affects immunity, mood, hormones, and bone density.' });
  if (!has('free_t3'))      recs.push({ test: 'Free T3 + Free T4', why: 'TSH alone misses most thyroid dysfunction. Free T3 is the active hormone that actually drives your metabolism.' });
  if (!has('hscrp'))        recs.push({ test: 'hsCRP (high sensitivity)', why: 'The most important cardiovascular and inflammation marker — rarely included in standard panels.' });
  if (!has('homocysteine')) recs.push({ test: 'Homocysteine', why: 'Sensitive marker for B12/folate status and methylation — significant cardiovascular and neurological risk marker when elevated.' });
  if (!has('cortisol'))     recs.push({ test: 'AM Cortisol (fasting)', why: 'Assesses adrenal function and stress hormone status — critical for understanding energy, weight, and resilience.' });
  if (!has('magnesium'))    recs.push({ test: 'Magnesium RBC', why: 'Deficiency is the second most common nutritional deficiency. Involved in 300+ enzymatic reactions. Standard serum magnesium is nearly useless — get RBC magnesium.' });

  if (patterns.some(p => p.name.includes('Thyroid') || p.name.includes('thyroid'))) {
    if (!has('tsh') || !has('free_t3')) recs.push({ test: 'Full Thyroid Panel (TSH + Free T3 + Free T4 + Reverse T3 + TPO antibodies)', why: 'Your results suggest thyroid dysfunction — a complete panel is needed to see the full picture.' });
  }

  if (patterns.some(p => p.name.includes('Iron'))) {
    if (!has('serum_iron') || !has('tibc')) recs.push({ test: 'Complete Iron Panel (serum iron + TIBC + transferrin saturation)', why: 'Completes the iron deficiency picture alongside ferritin.' });
  }

  return recs.slice(0, 6);
}

// ── BUILD HTML REPORT ─────────────────────────────────────────────────────────
function buildReportHTML(name, email, markers, patterns, actions, followUpLabs) {
  const flagCount = markers.flagged.length;
  const cautionCount = markers.caution.length;
  const optimalCount = markers.optimal.length;
  const total = markers.entered;
  const optimalPct = total > 0 ? Math.round((optimalCount / total) * 100) : 0;

  const scoreColor = optimalPct >= 80 ? '#16a34a' : optimalPct >= 60 ? '#d97706' : '#dc2626';
  const scoreLabel = optimalPct >= 80 ? 'Strong Foundation' : optimalPct >= 60 ? 'Areas to Address' : 'Significant Patterns Detected';

  const catOrder = ['Metabolism', 'Thyroid', 'Hormones', 'Lipids', 'Iron & Nutrients', 'Inflammation', 'Liver', 'CBC', 'Metabolic'];

  // Group flagged + caution by category
  const allIssues = [...markers.flagged, ...markers.caution];
  const byCategory = {};
  for (const m of allIssues) {
    if (!byCategory[m.cat]) byCategory[m.cat] = [];
    byCategory[m.cat].push(m);
  }

  const markerRows = catOrder
    .filter(cat => byCategory[cat])
    .map(cat => `
      <tr><td colspan="5" style="background:#f7f2ec;padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7a7a7a;border-top:2px solid #e5e0d8;">${cat}</td></tr>
      ${byCategory[cat].map(m => `
        <tr style="border-bottom:1px solid #f0ebe4;">
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;">${m.name}</td>
          <td style="padding:12px 16px;font-size:14px;color:#374151;font-weight:700;">${m.val} ${m.unit}</td>
          <td style="padding:12px 8px;font-size:13px;color:#6b7280;">${m.lo}–${m.hi} ${m.unit}</td>
          <td style="padding:12px 8px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${m.status === 'flag' ? '#fef2f2' : '#fffbeb'};color:${m.status === 'flag' ? '#dc2626' : '#d97706'};">${m.label}</span>
          </td>
        </tr>
        <tr style="border-bottom:2px solid #f0ebe4;">
          <td colspan="4" style="padding:6px 16px 16px;font-size:13px;color:#4b5563;line-height:1.7;">${m.explanation}${m.fix ? `<br><br><strong style="color:#111827;">What to do:</strong> ${m.fix}` : ''}</td>
        </tr>
      `).join('')}
    `).join('');

  const patternHTML = patterns.length > 0 ? patterns.map(p => `
    <div style="border:1px solid #e5e0d8;border-radius:4px;padding:24px;margin-bottom:16px;background:white;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:700;color:#111827;">${p.name}</div>
        <div style="background:#05152e;color:white;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;">${p.confidence}% match</div>
      </div>
      <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0;">${p.description}</p>
    </div>
  `).join('') : '<p style="color:#6b7280;font-size:14px;">No strong patterns detected with the markers provided. Consider adding more lab values for a complete picture.</p>';

  const actionHTML = actions.map((a, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#05152e;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${i + 1}</div>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:4px 0 0;">${a}</p>
    </div>
  `).join('');

  const followUpHTML = followUpLabs.map(f => `
    <div style="border-left:3px solid #e07b6a;padding:12px 16px;margin-bottom:12px;background:white;">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">${f.test}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.6;">${f.why}</div>
    </div>
  `).join('');

  const optimalHTML = markers.optimal.length > 0 ? markers.optimal.map(m =>
    `<span style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:4px 12px;border-radius:12px;font-size:13px;margin:4px;">${m.name} ✓</span>`
  ).join('') : '<p style="color:#6b7280;font-size:14px;">Add more lab values to see your optimal markers.</p>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Functional Health Report — Function Again Health</title>
</head>
<body style="margin:0;padding:0;background:#f7f2ec;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">

  <!-- Header -->
  <div style="background:#05152e;padding:32px 40px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:white;letter-spacing:.03em;">Function<span style="color:#e07b6a;font-style:italic;">Again</span> Health</div>
    <div style="font-size:13px;color:rgba(255,255,255,.4);margin-top:4px;">functionagainhealth.com</div>
  </div>

  <div style="max-width:700px;margin:0 auto;padding:40px 20px;">

    <!-- Title Card -->
    <div style="background:white;border-radius:4px;padding:36px;margin-bottom:24px;text-align:center;border:1px solid #e5e0d8;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#e07b6a;margin-bottom:12px;">Your Functional Health Report</div>
      <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;color:#111827;margin:0 0 8px;line-height:1.2;">Hi${name ? ', ' + name : ''}.</h1>
      <p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 28px;">Here is your personalized functional health analysis based on ${total} lab markers entered.</p>
      
      <!-- Score -->
      <div style="display:inline-block;background:#f7f2ec;border-radius:4px;padding:20px 40px;">
        <div style="font-family:Georgia,serif;font-size:48px;font-weight:300;color:${scoreColor};line-height:1;">${optimalPct}%</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">${scoreLabel}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:8px;">${optimalCount} optimal · ${cautionCount} watch · ${flagCount} flagged</div>
      </div>
    </div>

    ${patterns.length > 0 ? `
    <!-- Patterns -->
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#111827;margin:0 0 16px;">Patterns Detected</h2>
      ${patternHTML}
    </div>
    ` : ''}

    <!-- Marker Analysis -->
    ${allIssues.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#111827;margin:0 0 16px;">Marker Analysis</h2>
      <div style="background:white;border-radius:4px;overflow:hidden;border:1px solid #e5e0d8;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f7f2ec;">
              <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;">Marker</th>
              <th style="padding:12px 8px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;">Your Value</th>
              <th style="padding:12px 8px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;">Optimal Range</th>
              <th style="padding:12px 8px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;">Status</th>
            </tr>
          </thead>
          <tbody>${markerRows}</tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Action Plan -->
    ${actions.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#111827;margin:0 0 16px;">Priority Action Plan</h2>
      <div style="background:white;border-radius:4px;padding:28px;border:1px solid #e5e0d8;">
        <p style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.7;">Ranked by impact. Start with #1 and work your way down.</p>
        ${actionHTML}
      </div>
    </div>
    ` : ''}

    <!-- Follow-Up Labs -->
    ${followUpLabs.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#111827;margin:0 0 8px;">Recommended Follow-Up Labs</h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">These tests would complete your picture and are available without a doctor's order.</p>
      ${followUpHTML}
      <div style="background:#05152e;border-radius:4px;padding:20px 24px;margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:14px;font-weight:700;color:white;margin-bottom:4px;">Order Labs Without a Doctor</div>
          <div style="font-size:13px;color:rgba(255,255,255,.55);">Ulta Lab Tests — no physician order required</div>
        </div>
        <a href="https://www.ultalabtests.com" style="background:#e07b6a;color:white;padding:10px 20px;border-radius:4px;font-size:13px;font-weight:700;text-decoration:none;">Order Now →</a>
      </div>
    </div>
    ` : ''}

    <!-- Optimal Markers -->
    ${markers.optimal.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#111827;margin:0 0 12px;">What's Looking Good ✓</h2>
      <div style="background:white;border-radius:4px;padding:24px;border:1px solid #e5e0d8;">
        ${optimalHTML}
      </div>
    </div>
    ` : ''}

    <!-- Work with Sara -->
    <div style="background:#05152e;border-radius:4px;padding:36px;text-align:center;margin-bottom:24px;">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:white;margin-bottom:12px;">Want Sara to walk you through this?</div>
      <p style="font-size:14px;color:rgba(255,255,255,.65);line-height:1.7;max-width:480px;margin:0 auto 24px;">Your report gives you the full picture. A 1:1 session turns that into a personalized protocol — what to do, in what order, for your specific biology.</p>
      <a href="mailto:sara@functionagainhealth.com" style="display:inline-block;background:#e07b6a;color:white;padding:14px 32px;border-radius:4px;font-size:15px;font-weight:700;text-decoration:none;">Book a Session — $149</a>
    </div>

    <!-- Disclaimer -->
    <div style="background:#f7f2ec;border-radius:4px;padding:20px;border:1px solid #e5e0d8;">
      <p style="font-size:12px;color:#9ca3af;line-height:1.7;margin:0;">This report is for educational purposes only and does not constitute medical advice or a clinical diagnosis. Functional reference ranges are based on evidence-based optimal health literature and differ from standard laboratory reference ranges. Always discuss findings with your licensed healthcare provider before making health decisions.</p>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#0d1b2a;padding:24px 40px;text-align:center;">
    <div style="font-size:12px;color:rgba(255,255,255,.3);">© 2026 Function Again Health · functionagainhealth.com · sara@functionagainhealth.com</div>
  </div>

</body>
</html>`;
}

// ── SEND EMAIL VIA RESEND ────────────────────────────────────────────────────
async function sendEmail(to, name, reportHtml) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log('[EMAIL] No Resend key — skipping email, returning report inline');
    return { skipped: true };
  }

  const https = require('https');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'Function Again Health <reports@functionagainhealth.com>',
      to: [to],
      subject: 'Your Functional Health Report — Function Again Health',
      html: reportHtml,
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { labs, email, name, sessionId } = JSON.parse(event.body || '{}');
    if (!labs) return { statusCode: 400, body: JSON.stringify({ error: 'Missing labs' }) };

    // Verify Stripe payment (skip in demo mode)
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const isDemoMode = !stripeKey || stripeKey.includes('demo_mode') || (sessionId && sessionId.startsWith('demo_'));

    if (!isDemoMode && sessionId) {
      const https = require('https');
      const session = await new Promise((resolve, reject) => {
        https.get({ hostname: 'api.stripe.com', path: `/v1/checkout/sessions/${sessionId}`, headers: { Authorization: `Bearer ${stripeKey}` } }, res => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        }).on('error', reject);
      });
      if (session.payment_status !== 'paid') {
        return { statusCode: 402, body: JSON.stringify({ error: 'Payment not confirmed' }) };
      }
    }

    // Run analysis
    const markers    = analyzeMarkers(labs);
    const patterns   = detectPatterns(labs);
    const actions    = buildActionPlan(markers.flagged, markers.caution, patterns);
    const followUps  = recommendFollowUpLabs(labs, markers.flagged, patterns);
    const reportHtml = buildReportHTML(name, email, markers, patterns, actions, followUps);

    // Send email if address provided
    let emailResult = null;
    if (email) {
      emailResult = await sendEmail(email, name, reportHtml);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        report: reportHtml,
        patterns: patterns.length,
        flagged: markers.flagged.length,
        caution: markers.caution.length,
        optimal: markers.optimal.length,
        emailSent: emailResult && !emailResult.skipped,
      }),
    };
  } catch (e) {
    console.error('[generate-report] Error:', e.message, e.stack);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
