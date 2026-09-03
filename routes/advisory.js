// =============================================================================
// Gramin Udyam Sahayak – Runtime RAG Advisory Route
// Endpoint: POST /api/generate-advisory
// Deterministic Financial Engine + Supabase pgvector Retrieval + Gemini LLM
// =============================================================================

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { pipeline, env } from '@xenova/transformers';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MODELS_DIR = path.resolve(ROOT_DIR, 'models');

// Configure Transformers to load local ONNX model from disk without remote network calls
env.localModelPath = MODELS_DIR;
env.allowRemoteModels = false;

import https from 'https';

const router = Router();

// ── Resilient Fetch Helper (60s Timeout) ─────────────────────────────────────
function resilientFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const headers = {};
    if (options.headers) {
      new Headers(options.headers).forEach((v, k) => { headers[k] = v; });
    }

    const req = https.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers,
      timeout: 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: new Headers(res.headers),
          json: async () => JSON.parse(bodyBuffer.toString('utf8')),
          text: async () => bodyBuffer.toString('utf8'),
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('resilientFetch timeout (60s exceeded)')));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Environment & Clients ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    global: { fetch: resilientFetch },
  });
}

let genai = null;
if (GEMINI_API_KEY) {
  genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// ── Model Configurations ─────────────────────────────────────────────────────
const GENERATION_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];
const TARGET_EMBEDDING_DIM = 768;

// ── Deterministic Sector Fallback Knowledge ──────────────────────────────────
const SECTOR_OFFLINE_DEFAULTS = {
  'Dairy & Livestock': {
    estimatedCustomers: 1250,
    catchmentRadiusKm: 5,
    distributionChannels: ['Local Milk Cooperatives', 'Direct Village Sales', 'Nearby Semi-Urban Sweet Shops'],
    opportunityAnalysis: [
      'High recurring demand for fresh and chilled pasteurized milk.',
      'Availability of PMFME capital subsidies on bulk milk coolers and chilling units.',
      'Opportunity to produce value-added items such as paneer, curd, and ghee.',
    ],
    swotAnalysis: {
      strengths: ['Abundant fodder and local livestock experience', 'Daily cash-flow generation'],
      weaknesses: ['Vulnerability to power grid instability', 'Cold storage dependency'],
      opportunities: ['Direct supply contracts with dairy cooperatives', 'Cattle health insurance schemes'],
      threats: ['Seasonal summer yield drops', 'Fodder price inflation'],
    },
    localRisks: [
      { title: 'Water Availability', description: 'Summer water scarcity can affect cattle milk yields.', severity: 'HIGH' },
      { title: 'Cold Chain Failure', description: 'Power cuts without backup can cause milk spoilage.', severity: 'MEDIUM' },
    ],
    competitorMapping: {
      densityIndex: 'LOW',
      summary: 'Few organized dairy chilling units within a 5km radius; market largely unorganized.',
    },
    pricingStrategy: {
      suggestedPriceUnit: '₹ / Liter',
      benchmarkPrice: '₹ 55–62',
    },
  },
  'Handloom & Textiles': {
    estimatedCustomers: 850,
    catchmentRadiusKm: 8,
    distributionChannels: ['State Cooperative Emporiums', 'Weekly Haats', 'Regional E-Commerce Aggregators'],
    opportunityAnalysis: [
      'Surging demand for authentic handloom, Khadi, and sustainable natural dyed fabrics.',
      'Access to NHDP (National Handloom Development Programme) raw material yarn subsidies.',
      'Zero GST exemptions on select traditional woven garments.',
    ],
    swotAnalysis: {
      strengths: ['Generational weaving craft skill', 'Low capital entry barrier'],
      weaknesses: ['Lack of mechanized finishing and dyeing facilities', 'Working capital lock-in'],
      opportunities: ['Urban festive exhibitions', 'Direct government weaver portal procurement'],
      threats: ['Competition from cheap powerloom and polyester textiles', 'Fluctuating cotton yarn prices'],
    },
    localRisks: [
      { title: 'Yarn Price Volatility', description: 'Fluctuating yarn costs can erode weaver operating margins.', severity: 'HIGH' },
      { title: 'Lead Time Delays', description: 'Manual production cycles can cause shipment delivery delays.', severity: 'LOW' },
    ],
    competitorMapping: {
      densityIndex: 'LOW',
      summary: 'Strong artisan cluster but fragmented direct-to-consumer marketing channels.',
    },
    pricingStrategy: {
      suggestedPriceUnit: '₹ / Piece',
      benchmarkPrice: '₹ 850–1,250',
    },
  },
  'Grocery & Retail': {
    estimatedCustomers: 2100,
    catchmentRadiusKm: 3,
    distributionChannels: ['Walk-in Village Customers', 'Home Delivery to Hamlets', 'UPI Credit Accounts'],
    opportunityAnalysis: [
      'Steady daily FMCG and staple grain demand across surrounding hamlets.',
      'Adoption of digital payments (UPI) and micro-credit ledger apps.',
      'Direct bulk procurement from APMC mandis to improve margins.',
    ],
    swotAnalysis: {
      strengths: ['Prime roadside frontage', 'High inventory turnover of daily essentials'],
      weaknesses: ['Customer credit expectation (Khata book)', 'Limited floor space'],
      opportunities: ['Stocking packaged regional staples', 'Mini banking / DigiPay kiosk services'],
      threats: ['Margin compression on branded FMCG', 'Seasonal rural income cycles'],
    },
    localRisks: [
      { title: 'Credit Default Risk', description: 'Uncollected informal credit book dues during lean crop months.', severity: 'HIGH' },
      { title: 'Perishable Wastage', description: 'Spoilage of unpackaged grains and perishable groceries.', severity: 'LOW' },
    ],
    competitorMapping: {
      densityIndex: 'MEDIUM',
      summary: 'Moderate density of general stores; differentiated inventory and fair pricing capture loyalty.',
    },
    pricingStrategy: {
      suggestedPriceUnit: 'Gross Margin %',
      benchmarkPrice: '12–18%',
    },
  },
  'Agro-Processing': {
    estimatedCustomers: 1600,
    catchmentRadiusKm: 10,
    distributionChannels: ['Local APMC Traders', 'Regional Retailers', 'Farmer Producer Organizations (FPOs)'],
    opportunityAnalysis: [
      'Proximity to raw pulse, grain, and oilseed harvests reduces raw material freight.',
      'Up to 35% credit-linked capital subsidy under the PMFME scheme.',
      'High value addition in custom flour milling and mustard/groundnut oil expelling.',
    ],
    swotAnalysis: {
      strengths: ['Direct farmgate crop proximity', 'Year-round processing utility'],
      weaknesses: ['Higher electrical load requirement', 'Post-harvest warehousing deficit'],
      opportunities: ['Branded packaging for regional town distribution', 'Bio-waste byproduct utilization'],
      threats: ['Monsoon crop failure or yield fluctuations', 'Machinery breakdown during peak season'],
    },
    localRisks: [
      { title: 'Seasonal Supply Glut', description: 'Prices fluctuate significantly immediately post-harvest.', severity: 'HIGH' },
      { title: 'Equipment Maintenance', description: 'Spare parts procurement requires travel to district headquarters.', severity: 'MEDIUM' },
    ],
    competitorMapping: {
      densityIndex: 'LOW',
      summary: 'Shortage of modern agro-processing mills within a 10km radius.',
    },
    pricingStrategy: {
      suggestedPriceUnit: '₹ / Kg Processed',
      benchmarkPrice: '₹ 110–140',
    },
  },
  'Handicrafts': {
    estimatedCustomers: 650,
    catchmentRadiusKm: 15,
    distributionChannels: ['District Craft Melas', 'ODOP State Sales Outlets', 'Corporate Gifting Tie-ups'],
    opportunityAnalysis: [
      'Beneficiary of One District One Product (ODOP) institutional marketing.',
      'Growing consumer appreciation for eco-friendly terracotta, bamboo, and brass crafts.',
      'Subsidized artisan identity cards offering access to interest-subvention loans.',
    ],
    swotAnalysis: {
      strengths: ['Authentic regional craftsmanship', 'Low non-biodegradable footprint'],
      weaknesses: ['Seasonal tourist dependency', 'Lack of modern design packaging'],
      opportunities: ['Exhibition stalls at national handloom and craft expos', 'Export intermediary contracts'],
      threats: ['Cheap synthetic and plastic decorative substitutes', 'Youth migration away from traditional craft'],
    },
    localRisks: [
      { title: 'Raw Material Seasonality', description: 'Clay and natural fiber availability hampered during heavy monsoon.', severity: 'HIGH' },
      { title: 'Intermediary Margins', description: 'Middlemen taking large commissions on remote sales.', severity: 'MEDIUM' },
    ],
    competitorMapping: {
      densityIndex: 'LOW',
      summary: 'Unique regional artisan presence with little direct local competition.',
    },
    pricingStrategy: {
      suggestedPriceUnit: '₹ / Article',
      benchmarkPrice: '₹ 350–550',
    },
  },
};

// ── Sector Revenue Benchmarks for Viability Calculation ──────────────────────
const SECTOR_REVENUE_BENCHMARKS = {
  'Dairy & Livestock': { monthlyRevenuePerLakhInvestment: 3300, operatingExpenseRatio: 0.55 },
  'Handloom & Textiles': { monthlyRevenuePerLakhInvestment: 2500, operatingExpenseRatio: 0.50 },
  'Grocery & Retail': { monthlyRevenuePerLakhInvestment: 8000, operatingExpenseRatio: 0.85 },
  'Agro-Processing': { monthlyRevenuePerLakhInvestment: 4000, operatingExpenseRatio: 0.60 },
  'Handicrafts': { monthlyRevenuePerLakhInvestment: 2000, operatingExpenseRatio: 0.45 },
};

// ── Helper: Generate Quarterly Repayment Schedule ────────────────────────────
function generateRepaymentSchedule(principal, annualRate, tenureMonths, gracePeriodMonths) {
  const schedule = [];
  const quarterlyRate = annualRate / 400;
  const totalQuarters = Math.ceil(tenureMonths / 3);
  const graceQuarters = Math.ceil(gracePeriodMonths / 3);
  const repaymentQuarters = totalQuarters - graceQuarters;
  let balance = principal;

  for (let q = 1; q <= graceQuarters; q++) {
    const interestPaid = Math.round(balance * quarterlyRate);
    schedule.push({ quarter: q, type: 'MORATORIUM', principalPaid: 0, interestPaid, balance });
  }

  if (repaymentQuarters > 0 && balance > 0) {
    const qr = quarterlyRate;
    const n = repaymentQuarters;
    const factor = Math.pow(1 + qr, n);
    const quarterlyInstallment = Math.round((balance * qr * factor) / (factor - 1));

    for (let q = graceQuarters + 1; q <= totalQuarters; q++) {
      const interestPaid = Math.round(balance * qr);
      const principalPaid = Math.min(quarterlyInstallment - interestPaid, balance);
      balance = Math.max(0, balance - principalPaid);
      schedule.push({ quarter: q, type: 'REPAYMENT', principalPaid, interestPaid, balance: Math.round(balance) });
    }
  }
  return schedule;
}

// ── Helper: Calculate Viability Metrics ──────────────────────────────────────
function calculateViabilityMetrics(totalProjectSize, businessCategory, calculatedEMI) {
  const benchmark = SECTOR_REVENUE_BENCHMARKS[businessCategory] || SECTOR_REVENUE_BENCHMARKS['Dairy & Livestock'];
  const projectLakhs = totalProjectSize / 100000;
  const estimatedMonthlyRevenue = Math.round(projectLakhs * benchmark.monthlyRevenuePerLakhInvestment);
  const estimatedMonthlyExpenses = Math.round(estimatedMonthlyRevenue * benchmark.operatingExpenseRatio);
  const netMonthlySurplus = estimatedMonthlyRevenue - estimatedMonthlyExpenses;
  const dscr = calculatedEMI > 0 ? parseFloat((netMonthlySurplus / calculatedEMI).toFixed(2)) : 0;
  const breakEvenMonths = netMonthlySurplus > 0 ? Math.ceil(totalProjectSize / netMonthlySurplus) : 999;
  const viabilityRating = dscr >= 1.5 ? 'STRONG' : dscr >= 1.0 ? 'MODERATE' : 'WEAK';
  return { estimatedMonthlyRevenue, estimatedMonthlyExpenses, netMonthlySurplus, dscr, breakEvenMonths, viabilityRating };
}

// ── Helper: Zero-Padding to 768 Dimensions ──────────────────────────────────
function padTo768(vector) {
  if (!vector || !Array.isArray(vector)) return new Array(TARGET_EMBEDDING_DIM).fill(0);
  if (vector.length === TARGET_EMBEDDING_DIM) return vector;
  if (vector.length > TARGET_EMBEDDING_DIM) return vector.slice(0, TARGET_EMBEDDING_DIM);
  const padded = new Array(TARGET_EMBEDDING_DIM).fill(0);
  for (let i = 0; i < vector.length; i++) {
    padded[i] = vector[i];
  }
  return padded;
}

// ── Helper: Local Hugging Face Pipeline Instance ─────────────────────────────
let localExtractor = null;
async function getLocalExtractor() {
  if (!localExtractor) {
    localExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return localExtractor;
}

// ── Helper: Generate 768-dim Vector Embedding for Query ──────────────────────
async function generateQueryEmbedding(queryText) {
  try {
    const extractor = await getLocalExtractor();
    const output = await extractor(queryText, { pooling: 'mean', normalize: true });
    const rawVector = Array.from(output.data);
    return padTo768(rawVector);
  } catch (err) {
    console.warn(`Local query embedding generation failed: ${err.message}`);
    return null;
  }
}

// ── Helper: Query Supabase RPC match_document_chunks ─────────────────────────
async function queryVectorDatabase(queryVector) {
  if (!supabase || !queryVector) return { chunks: [], source: 'No DB configured' };

  try {
    const rpcPromise = supabase.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: 0.25,
      match_count: 5,
    });

    // 20-second timeout to allow TLS handshake & semantic search on high-latency connections
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase RPC match_document_chunks timed out')), 20000)
    );

    const { data: contextChunks, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      console.warn('Supabase match_document_chunks notice:', error.message);
      return { chunks: [], source: `Supabase RPC notice: ${error.message}` };
    }

    if (contextChunks && contextChunks.length > 0) {
      return { chunks: contextChunks, source: 'Supabase pgvector RAG' };
    }

    return { chunks: [], source: 'No chunks matched threshold (0.25)' };
  } catch (err) {
    console.warn('Vector retrieval error (falling back to AI domain knowledge):', err.message);
    return { chunks: [], source: `Retrieval fallback: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENDPOINT: POST /api/generate-advisory
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-advisory', async (req, res) => {
  const startTime = Date.now();

  try {
    const { location, businessCategory, language } = req.body;
    let { marginMoney } = req.body;
    const reportLanguage = ['HI', 'GU'].includes(language) ? language : 'EN';

    // ── STEP 1: Input Validation & Deterministic Financial Calculations ────────
    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'location is required and must be at least 2 characters long.',
      });
    }

    if (!businessCategory || typeof businessCategory !== 'string' || businessCategory.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'businessCategory is required.',
      });
    }

    // Default to 14,000 if omitted in legacy calls, but validate strictly if provided
    if (marginMoney === undefined || marginMoney === null || marginMoney === '') {
      marginMoney = 14000;
    }

    const parsedMargin = Number(marginMoney);
    if (isNaN(parsedMargin) || parsedMargin <= 0) {
      return res.status(400).json({
        success: false,
        error: 'marginMoney must be a positive number greater than 0.',
      });
    }

    // ── Deterministic Financial Calculations ──────────────────
    // marginMoney = User input (10% contribution)
    // totalProjectSize = marginMoney * 10
    // loanEligibility = totalProjectSize * 0.90
    const userContribution = parsedMargin;
    const totalProjectSize = userContribution * 10;

    // Scheme Routing Logic with NBCFDC Caps
    let activeScheme = '';
    let interestRate = 0.0;
    let tenureMonths = 0;
    let gracePeriodMonths = 0;
    let maxLoanEligibility = 0;
    let schemeExceeded = false;

    if (totalProjectSize > 5000000) {
      // Exceeds SCA concessional credit limits
      schemeExceeded = true;
      activeScheme = 'Term Loan Scheme';
      interestRate = 8.0;
      tenureMonths = 84;
      gracePeriodMonths = 6;
      maxLoanEligibility = 4500000; // Hard cap
    } else if (totalProjectSize <= 140000) {
      activeScheme = 'Micro Finance Scheme';
      interestRate = 6.5;
      tenureMonths = 36;
      gracePeriodMonths = 3;
      maxLoanEligibility = Math.min(totalProjectSize * 0.9, 125000); // Micro cap: ₹1.25L
    } else {
      activeScheme = 'Term Loan Scheme';
      interestRate = 8.0;
      tenureMonths = 84;
      gracePeriodMonths = 6;
      maxLoanEligibility = Math.min(totalProjectSize * 0.9, 4500000); // Term cap: ₹45L
    }

    // EMI Calculation (reducing-balance)
    const monthlyRate = interestRate / (12 * 100);
    const n = tenureMonths;
    const P = maxLoanEligibility;
    const factor = Math.pow(1 + monthlyRate, n);
    const calculatedEMI = P > 0 ? Math.round((P * monthlyRate * factor) / (factor - 1)) : 0;

    // Generate quarterly repayment schedule
    const repaymentSchedule = generateRepaymentSchedule(maxLoanEligibility, interestRate, tenureMonths, gracePeriodMonths);

    // Calculate viability metrics
    const viabilityMetrics = calculateViabilityMetrics(totalProjectSize, businessCategory.trim(), calculatedEMI);

    const financialSummary = {
      userContribution,
      maxLoanEligibility,
      totalProjectSize,
      activeScheme,
      interestRate,
      tenureMonths,
      gracePeriodMonths,
      estimatedEMI: calculatedEMI,
      schemeExceeded,
    };

    console.log(`\n=============================================================`);
    console.log(`🌾 [Generate Advisory] Location: "${location}" | Sector: "${businessCategory}"`);
    console.log(`💰 Financial Summary: Contribution ₹${userContribution} -> Project ₹${totalProjectSize} -> Loan ₹${maxLoanEligibility} (EMI: ₹${calculatedEMI}/mo)`);
    console.log(`📋 Scheme: ${activeScheme} @ ${interestRate}% (${tenureMonths} mos, ${gracePeriodMonths} mos grace)`);

    // ── STEP 2: Retrieval Pipeline (Supabase pgvector) ─────────────────────────
    const searchQuery = `Business feasibility, market demand, DPR guidelines, costs and financial benchmark for ${businessCategory} in ${location}, India`;
    console.log(`🔍 [RAG Step 2] Generating query vector embedding...`);

    const queryVector = await generateQueryEmbedding(searchQuery);
    let retrievedContext = '';
    let ragSource = 'AI Domain Knowledge (RAG fallback)';
    let matchedChunksCount = 0;
    let matchedFiles = [];

    if (queryVector) {
      console.log(`📡 [RAG Step 2] Querying Supabase RPC match_document_chunks...`);
      const { chunks, source } = await queryVectorDatabase(queryVector);
      ragSource = source;

      if (chunks && chunks.length > 0) {
        matchedChunksCount = chunks.length;
        matchedFiles = [...new Set(chunks.map((c) => c.file_name))];
        retrievedContext = chunks
          .map(
            (c, idx) =>
              `[Document ${idx + 1}: ${c.file_name} (Chunk ${c.chunk_index}) - Similarity: ${(c.similarity * 100).toFixed(1)}%]\n${c.content}`
          )
          .join('\n\n---\n\n');
        console.log(`✅ [RAG Step 2] Retrieved ${chunks.length} chunks from: ${matchedFiles.join(', ')}`);
      } else {
        console.log(`ℹ️ [RAG Step 2] ${source}. Using AI domain knowledge.`);
      }
    } else {
      console.warn(`⚠️ [RAG Step 2] Could not generate query embedding. Using AI domain knowledge.`);
    }

    // ── STEP 3: Generation Pipeline (Augmented Prompting with Gemini) ──────────
    let feasibilityReport = null;

    if (genai) {
      const languageInstruction = reportLanguage === 'HI'
        ? `\nIMPORTANT LANGUAGE INSTRUCTION: Generate ALL text content (opportunities, SWOT items, risk descriptions, competitor summary, pricing notes) in Hindi (Devanagari script). Keep numeric values, scheme names (PMFME, PMEGP, ODOP, CGTMSE), and JSON keys in English.`
        : reportLanguage === 'GU'
        ? `\nIMPORTANT LANGUAGE INSTRUCTION: Generate ALL text content (opportunities, SWOT items, risk descriptions, competitor summary, pricing notes) in Gujarati (ગુજરાતી script). Keep numeric values, scheme names (PMFME, PMEGP, ODOP, CGTMSE), and JSON keys in English.`
        : '';

      const ragPrompt = `You are a principal rural micro-enterprise feasibility advisor for the Government of India's "Gramin Udyam Sahayak" portal.
Your task is to analyze the local business environment and produce an actionable feasibility and advisory report.${languageInstruction}

BORROWER PROFILE & FINANCIAL ENGINE VALUES:
- Location: "${location.trim()}", India
- Sector / Business Category: "${businessCategory.trim()}"
- Borrower Equity Margin (10%): ₹${userContribution}
- Total Project Size (100%): ₹${totalProjectSize}
- Concessional Loan Sanction (90%): ₹${maxLoanEligibility}
- Government Scheme: "${activeScheme}" (Interest: ${interestRate}% p.a., Tenure: ${tenureMonths} Months, Grace Period: ${gracePeriodMonths} Months)
- Computed Monthly EMI: ₹${calculatedEMI}

${
  retrievedContext
    ? `VERIFIED LOCAL GOVERNMENT DPR & KNOWLEDGE BASE CONTEXT (RAG):
----------------------------------------------------------------------
${retrievedContext}
----------------------------------------------------------------------
Synthesize the specific facts, costs, machinery parameters, and guidelines from the context above whenever applicable.`
    : `(Note: Rely on official Indian rural entrepreneurship domain standards for ${businessCategory} in ${location}.)`
}

INSTRUCTIONS:
1. Provide realistic rural Indian market estimates for "${location}" (customers, radius, pricing, SWOT, risks).
2. Keep SWOT points concrete and concise (under 8 words per item).
3. Ensure competitorMapping and localRisks highlight realistic rural obstacles (e.g. power reliability, working capital lock-in, raw material seasonality).
4. Return ONLY a valid JSON object matching this EXACT schema with NO markdown ticks, NO backticks, and NO conversational text:

{
  "financialSummary": {
    "userContribution": ${userContribution},
    "maxLoanEligibility": ${maxLoanEligibility},
    "totalProjectSize": ${totalProjectSize},
    "activeScheme": "${activeScheme}",
    "interestRate": ${interestRate},
    "tenureMonths": ${tenureMonths},
    "gracePeriodMonths": ${gracePeriodMonths},
    "estimatedEMI": ${calculatedEMI}
  },
  "feasibilityReport": {
    "marketReach": {
      "estimatedCustomers": <number, e.g. 1400>,
      "catchmentRadiusKm": <number, e.g. 6>,
      "distributionChannels": [
        "<channel 1>",
        "<channel 2>",
        "<channel 3>"
      ]
    },
    "opportunityAnalysis": [
      "<opportunity 1: local market demand specific to ${location}>",
      "<opportunity 2: applicable central/state scheme subsidy like PMFME, ODOP, PMEGP>",
      "<opportunity 3: supply chain or value-addition advantage>"
    ],
    "swotAnalysis": {
      "strengths": ["<strength 1>", "<strength 2>"],
      "weaknesses": ["<weakness 1>", "<weakness 2>"],
      "opportunities": ["<opportunity 1>", "<opportunity 2>"],
      "threats": ["<threat 1>", "<threat 2>"]
    },
    "localRisks": [
      {
        "title": "<risk title>",
        "description": "<short description>",
        "severity": "HIGH"
      },
      {
        "title": "<risk title>",
        "description": "<short description>",
        "severity": "MEDIUM"
      }
    ],
    "competitorMapping": {
      "densityIndex": "LOW",
      "summary": "<short description of competitor density in ${location}>"
    },
    "pricingStrategy": {
      "suggestedPriceUnit": "<unit string, e.g. '₹ / Liter' or '₹ / Kg'>",
      "benchmarkPrice": "<suggested price range, e.g. '₹ 55–60'>"
    }
  }
}`;

      for (const model of GENERATION_MODELS) {
        try {
          console.log(`🤖 [RAG Step 3] Generating advisory report with model: ${model}...`);
          const genPromise = genai.models.generateContent({
            model,
            contents: ragPrompt,
          });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Model ${model} timed out after 7500ms`)), 7500)
          );
          const aiResponse = await Promise.race([genPromise, timeoutPromise]);

          const rawText = aiResponse.text?.trim() || '';
          if (!rawText) continue;

          // Strip markdown code fences if present
          let jsonStr = rawText;
          const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
          } else {
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = rawText.slice(firstBrace, lastBrace + 1).trim();
            }
          }

          const parsed = JSON.parse(jsonStr);
          if (parsed && (parsed.feasibilityReport || parsed.marketReach)) {
            feasibilityReport = parsed.feasibilityReport || parsed;
            console.log(`✅ [RAG Step 3] Gemini ${model} generation succeeded.`);
            break;
          }
        } catch (genErr) {
          console.warn(`Gemini generation with ${model} notice: ${genErr.message?.slice(0, 80)}`);
        }
      }
    }

    // ── STEP 4: Fallback & Error Handling ─────────────────────────────────────
    if (!feasibilityReport) {
      console.warn(`⚠️ [RAG Step 4] Using structured offline fallback knowledge for "${businessCategory}".`);
      const defaultData =
        SECTOR_OFFLINE_DEFAULTS[businessCategory] ||
        SECTOR_OFFLINE_DEFAULTS['Dairy & Livestock'];

      feasibilityReport = JSON.parse(JSON.stringify(defaultData));
      ragSource = 'Offline Advisory Fallback';
    }

    // Normalizing competitor density to valid uppercase enum
    const rawDensity = (feasibilityReport.competitorMapping?.densityIndex || 'LOW').toUpperCase();
    const densityIndex = ['LOW', 'MEDIUM', 'HIGH'].includes(rawDensity) ? rawDensity : 'LOW';
    if (feasibilityReport.competitorMapping) {
      feasibilityReport.competitorMapping.densityIndex = densityIndex;
    }

    // Build the exact required response object
    const finalResponseData = {
      financialSummary,
      feasibilityReport: {
        marketReach: {
          estimatedCustomers: Number(feasibilityReport.marketReach?.estimatedCustomers) || 1250,
          catchmentRadiusKm: Number(feasibilityReport.marketReach?.catchmentRadiusKm) || 5,
          distributionChannels: Array.isArray(feasibilityReport.marketReach?.distributionChannels)
            ? feasibilityReport.marketReach.distributionChannels
            : ['Local Village Direct Sales', 'Regional Market Wholesale'],
        },
        opportunityAnalysis: Array.isArray(feasibilityReport.opportunityAnalysis)
          ? feasibilityReport.opportunityAnalysis
          : ['High local demand', 'Government scheme subsidies applicable'],
        swotAnalysis: {
          strengths: Array.isArray(feasibilityReport.swotAnalysis?.strengths)
            ? feasibilityReport.swotAnalysis.strengths
            : ['Local Raw Material', 'Established Community Demand'],
          weaknesses: Array.isArray(feasibilityReport.swotAnalysis?.weaknesses)
            ? feasibilityReport.swotAnalysis.weaknesses
            : ['Power Instability', 'Working Capital Limitations'],
          opportunities: Array.isArray(feasibilityReport.swotAnalysis?.opportunities)
            ? feasibilityReport.swotAnalysis.opportunities
            : ['Nearby Urban Market Access', 'FPO Collaboration'],
          threats: Array.isArray(feasibilityReport.swotAnalysis?.threats)
            ? feasibilityReport.swotAnalysis.threats
            : ['Seasonal Raw Material Cost Hikes', 'Local Intermediary Pressure'],
        },
        localRisks: Array.isArray(feasibilityReport.localRisks)
          ? feasibilityReport.localRisks
          : [{ title: 'Operational Risk', description: 'Power outage or supply irregularity', severity: 'HIGH' }],
        competitorMapping: {
          densityIndex,
          summary:
            feasibilityReport.competitorMapping?.summary ||
            `Manageable competition in ${location}; differentiated quality can capture market share.`,
        },
        pricingStrategy: {
          suggestedPriceUnit: feasibilityReport.pricingStrategy?.suggestedPriceUnit || '₹ / Unit',
          benchmarkPrice: feasibilityReport.pricingStrategy?.benchmarkPrice || '₹ 50–60',
        },
      },

      // ── Repayment Schedule & Viability Metrics ────
      repaymentSchedule,
      viabilityMetrics,

      // ── Backward-compatible mapped fields for existing React App.tsx UI ────
      customers: `${feasibilityReport.marketReach?.estimatedCustomers || 1250}+`,
      customerRadius: `${feasibilityReport.marketReach?.catchmentRadiusKm || 5}km radius`,
      opportunities: Array.isArray(feasibilityReport.opportunityAnalysis)
        ? feasibilityReport.opportunityAnalysis
        : ['High regional demand', 'Concessional credit eligible'],
      swot: {
        s: feasibilityReport.swotAnalysis?.strengths?.[0] || 'Local Raw Material',
        w: feasibilityReport.swotAnalysis?.weaknesses?.[0] || 'Power Instability',
        o: feasibilityReport.swotAnalysis?.opportunities?.[0] || 'Growing Urban Demand',
        t: feasibilityReport.swotAnalysis?.threats?.[0] || 'Seasonal Supply Drop',
      },
      risks: (feasibilityReport.localRisks || []).map((r) => ({
        text: r.title ? `${r.title}: ${r.description || ''}` : (r.text || 'Operational Risk'),
        severe: r.severity === 'HIGH' || r.severe === true,
      })),
      competitorDensity: densityIndex === 'HIGH' ? 'High' : densityIndex === 'MEDIUM' ? 'Medium' : 'Low',
      densityPercentage: densityIndex === 'HIGH' ? 70 : densityIndex === 'MEDIUM' ? 45 : 25,
      benchmarkPrice: feasibilityReport.pricingStrategy?.benchmarkPrice || '₹ 55–60',
      benchmarkUnit: feasibilityReport.pricingStrategy?.suggestedPriceUnit || '/ Liter',
      localAvg: '₹50',
    };

    const executionMs = Date.now() - startTime;
    console.log(`✨ [Generate Advisory Completed in ${executionMs}ms] | RAG Source: ${ragSource}`);

    return res.status(200).json({
      success: true,
      ragMetadata: {
        contextRetrieved: matchedChunksCount > 0,
        contextSource: ragSource,
        chunksUsed: matchedChunksCount,
        matchedFiles,
        executionTimeMs: executionMs,
      },
      data: finalResponseData,
    });
  } catch (err) {
    console.error('💥 Unexpected error in /api/generate-advisory:', err);

    // Fail-safe offline response so UI never crashes even on fatal errors
    const fallbackContribution = 14000;
    const fallbackTotal = 140000;
    const fallbackLoan = Math.min(140000 * 0.9, 125000); // Enforced cap
    const fallbackRate = 6.5;
    const fallbackTenure = 36;
    const fallbackGrace = 3;
    const r = fallbackRate / (12 * 100);
    const n = fallbackTenure;
    const factor = Math.pow(1 + r, n);
    const emi = Math.round((fallbackLoan * r * factor) / (factor - 1));

    const defaultData = SECTOR_OFFLINE_DEFAULTS[req.body?.businessCategory] || SECTOR_OFFLINE_DEFAULTS['Dairy & Livestock'];
    const fallbackSchedule = generateRepaymentSchedule(fallbackLoan, fallbackRate, fallbackTenure, fallbackGrace);
    const fallbackViability = calculateViabilityMetrics(fallbackTotal, req.body?.businessCategory || 'Dairy & Livestock', emi);

    return res.status(200).json({
      success: true,
      warning: `Server caught error: ${err.message}. Returned resilient offline advisory.`,
      ragMetadata: {
        contextRetrieved: false,
        contextSource: 'Offline Emergency Fallback',
        chunksUsed: 0,
        matchedFiles: [],
      },
      data: {
        financialSummary: {
          userContribution: fallbackContribution,
          maxLoanEligibility: fallbackLoan,
          totalProjectSize: fallbackTotal,
          activeScheme: 'Micro Finance Scheme',
          interestRate: fallbackRate,
          tenureMonths: fallbackTenure,
          gracePeriodMonths: fallbackGrace,
          estimatedEMI: emi,
          schemeExceeded: false,
        },
        feasibilityReport: defaultData,
        repaymentSchedule: fallbackSchedule,
        viabilityMetrics: fallbackViability,
        customers: `${defaultData.estimatedCustomers}+`,
        customerRadius: `${defaultData.catchmentRadiusKm}km radius`,
        opportunities: defaultData.opportunityAnalysis,
        swot: {
          s: defaultData.swotAnalysis.strengths[0],
          w: defaultData.swotAnalysis.weaknesses[0],
          o: defaultData.swotAnalysis.opportunities[0],
          t: defaultData.swotAnalysis.threats[0],
        },
        risks: defaultData.localRisks.map((r) => ({ text: `${r.title}: ${r.description}`, severe: r.severity === 'HIGH' })),
        competitorDensity: 'Low',
        densityPercentage: 25,
        benchmarkPrice: defaultData.pricingStrategy.benchmarkPrice,
        benchmarkUnit: defaultData.pricingStrategy.suggestedPriceUnit,
        localAvg: '₹50',
      },
    });
  }
});

export default router;
