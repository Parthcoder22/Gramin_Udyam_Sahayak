#!/usr/bin/env node
// =============================================================================
// Gramin Udyam Sahayak – Production Local Hugging Face Ingestion Pipeline
// Features: Local Xenova/all-MiniLM-L6-v2 ONNX embeddings (Zero API rate limits),
// 768-dim zero padding for Supabase pgvector, fast text chunking & bulk indexing.
// =============================================================================

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import dns from 'dns';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

import { spawn } from 'child_process';

// Auto-relaunch with --dns-result-order=ipv4first on Windows to avoid IPv6 connect timeouts to Supabase
if (process.platform === 'win32' && !process.execArgv.some((arg) => arg.includes('dns-result-order'))) {
  const child = spawn(process.execPath, ['--dns-result-order=ipv4first', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  await new Promise(() => {}); // prevent parent execution
}

// Prioritize IPv4 lookup
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// ── 1. Configuration & Environment Setup ─────────────────────────────────────
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const MODELS_DIR = path.resolve(ROOT_DIR, 'models');

// Configure Transformers to load local ONNX models from disk without internet calls
env.localModelPath = MODELS_DIR;
env.allowRemoteModels = false;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// Chunking & Vector Constants
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 800; // ~800 characters
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 150; // 150 characters overlap
const DB_INSERT_BATCH_SIZE = 50; // Bulk insert batch size
const TARGET_EMBEDDING_DIM = 768; // pgvector column dimension in Supabase
const FORCE_REINGEST = process.argv.includes('--force') || process.env.FORCE_REINGEST === 'true';

// ── 2. Environment Validation ────────────────────────────────────────────────
console.log('\n=================================================================');
console.log('🌾 Gramin Udyam Sahayak – Local Hugging Face Ingestion Pipeline');
console.log('=================================================================');

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('\n❌ ERROR: Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  console.error('Please configure SUPABASE_URL and SUPABASE_SECRET_KEY in your .env file.\n');
  process.exit(1);
}

import https from 'https';

// ── 3. Client Initialization with 60s Resilient Fetch ────────────────────────
/**
 * Resilient HTTPS fetch with a 60-second timeout.
 * Eliminates Node 24 undici's 10-second connect timeout on high-latency networks.
 */
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: resilientFetch },
});

// ── 4. Helper Utilities ──────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pad a 384-dimensional raw vector up to 768 dimensions with trailing zeros
 * so it conforms to the existing Supabase VECTOR(768) schema.
 */
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

/**
 * Execute Supabase operation with retry on fetch failure or network drops
 */
async function supabaseOperationWithRetry(operationFn, operationName = 'DB Operation', retries = 4, initialDelay = 1500) {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt <= retries) {
    try {
      const result = await operationFn();
      if (result && result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }
      return result;
    } catch (err) {
      attempt++;
      const msg = err?.message || String(err);
      if (attempt > retries) {
        throw new Error(`${operationName} failed after ${retries} attempts: ${msg}`);
      }
      const waitMs = delay + Math.floor(Math.random() * 500);
      console.warn(`       ⚠️ ${operationName} notice (${msg.slice(0, 60)}...). Retrying in ${waitMs}ms (attempt ${attempt}/${retries})...`);
      await sleep(waitMs);
      delay *= 2;
    }
  }
}

/**
 * Infer business sector category from file name
 */
function inferCategory(fileName) {
  const name = fileName.toLowerCase();
  if (name.includes('dairy') || name.includes('cow') || name.includes('buffalo') || name.includes('milk')) {
    return 'Dairy & Livestock';
  }
  if (name.includes('garment') || name.includes('textile') || name.includes('charkha') || name.includes('weaving')) {
    return 'Handloom & Textiles';
  }
  if (name.includes('bakery') || name.includes('spice') || name.includes('food') || name.includes('cereal') || name.includes('soya')) {
    return 'Agro-Processing';
  }
  if (name.includes('paper') || name.includes('soap') || name.includes('polish') || name.includes('wiper') || name.includes('bag') || name.includes('wood')) {
    return 'Handicrafts & Rural Manufacturing';
  }
  if (name.includes('pmegp') || name.includes('pmfme') || name.includes('nulm') || name.includes('guidelines') || name.includes('pattern')) {
    return 'Government Scheme Guidelines';
  }
  return 'General Micro-Enterprise';
}

/**
 * Clean and normalize raw text extracted from PDF
 */
function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\w+)-\n(\w+)/g, '$1$2')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .trim();
}

/**
 * Fallback stream text extraction for damaged/corrupted PDFs with broken XRefs
 */
function extractTextFromCorruptPdf(fileBuffer) {
  try {
    const str = fileBuffer.toString('binary');
    const matches = [...str.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
    let collectedText = '';

    for (const [_, content] of matches) {
      try {
        const raw = Buffer.from(content, 'binary');
        const decompressed = zlib.inflateSync(raw).toString('utf8');
        const textPieces = [...decompressed.matchAll(/\((.*?)\)\s*Tj/g)].map((m) => m[1]);
        if (textPieces.length > 0) {
          collectedText += ' ' + textPieces.join(' ');
        }
      } catch (_) {}
    }

    return cleanExtractedText(collectedText);
  } catch (_) {
    return '';
  }
}

/**
 * Recursive character text chunking
 */
function recursiveCharacterChunk(text, chunkSize = CHUNK_SIZE, chunkOverlap = CHUNK_OVERLAP) {
  if (!text || text.length === 0) return [];
  if (text.length <= chunkSize) return [text];

  const chunks = [];
  let startIndex = 0;
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= text.length) {
      const lastChunk = text.slice(startIndex).trim();
      if (lastChunk.length > 0) chunks.push(lastChunk);
      break;
    }

    const windowStart = Math.max(startIndex + chunkOverlap, endIndex - 150);
    const textWindow = text.slice(windowStart, endIndex);

    let splitOffset = -1;
    for (const sep of separators) {
      const idx = textWindow.lastIndexOf(sep);
      if (idx !== -1) {
        splitOffset = windowStart + idx + sep.length;
        break;
      }
    }

    if (splitOffset === -1 || splitOffset <= startIndex) {
      splitOffset = endIndex;
    }

    const chunk = text.slice(startIndex, splitOffset).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = Math.max(startIndex + 1, splitOffset - chunkOverlap);
  }

  return chunks;
}

// ── 5. Main Ingestion Pipeline ───────────────────────────────────────────────
async function runPipeline() {
  const startTime = Date.now();

  // 1. Scan PDF directory
  if (!fs.existsSync(DATA_DIR)) {
    console.warn(`\n⚠️ WARNING: Data directory "${DATA_DIR}" does not exist.`);
    process.exit(0);
  }

  const allFiles = fs.readdirSync(DATA_DIR);
  const pdfFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.warn(`\n⚠️ WARNING: No PDF files found in directory "${DATA_DIR}".`);
    process.exit(0);
  }

  console.log(`📂 Found ${pdfFiles.length} PDF documents in: ${DATA_DIR}`);
  console.log(`⚙️  Configuration: Chunk Size = ${CHUNK_SIZE} chars | Overlap = ${CHUNK_OVERLAP} chars`);
  console.log(`⚡ Model: Xenova/all-MiniLM-L6-v2 (Local ONNX) | Target Dimension = ${TARGET_EMBEDDING_DIM}`);
  console.log('-----------------------------------------------------------------');

  // 2. Initialize Hugging Face pipeline once at startup
  console.log('🤖 Loading local Hugging Face model from disk...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Local feature-extraction pipeline ready! (Zero rate limits, zero API calls)');

  // 3. Verify Supabase Database Table
  console.log('🔍 Verifying Supabase Database connection...');
  try {
    const { error: pingError } = await supabase.from('document_chunks').select('id').limit(1);
    if (pingError) {
      if (pingError.message?.includes('schema cache')) {
        console.error('❌ ERROR: Table "document_chunks" not found in Supabase.');
        console.error('Please run scripts/rag_migration.sql in your Supabase SQL Editor first.\n');
        process.exit(1);
      }
      console.warn(`⚠️ Notice on DB check: ${pingError.message}`);
    } else {
      console.log('✅ Supabase connected & "document_chunks" table verified.');
    }
  } catch (err) {
    console.warn(`⚠️ Notice on initial DB check: ${err.message}`);
  }

  console.log('-----------------------------------------------------------------\n');

  let totalChunksIngested = 0;
  let successfulFiles = 0;
  let skippedAlreadyIngested = 0;
  let skippedCorruptedFiles = 0;
  let failedFiles = 0;

  // 4. Process each PDF sequentially
  for (let fileIdx = 0; fileIdx < pdfFiles.length; fileIdx++) {
    const fileName = pdfFiles[fileIdx];
    const filePath = path.join(DATA_DIR, fileName);
    const progressPrefix = `[${fileIdx + 1}/${pdfFiles.length}]`;
    const sector = inferCategory(fileName);

    // Fast check if file is already in Supabase (unless --force is passed)
    if (!FORCE_REINGEST) {
      try {
        const { count: existingCount } = await supabase
          .from('document_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('file_name', fileName);

        if (existingCount && existingCount > 0) {
          console.log(`${progressPrefix} 📄 "${fileName}": Already indexed in Supabase (${existingCount} chunks). Skipping.`);
          skippedAlreadyIngested++;
          continue;
        }
      } catch (_) {}
    }

    try {
      const fileStats = fs.statSync(filePath);
      const fileSizeKB = (fileStats.size / 1024).toFixed(1);

      console.log(`${progressPrefix} 📄 Processing: "${fileName}" (${fileSizeKB} KB)`);
      console.log(`       Sector: ${sector}`);

      // Step A: Parse PDF
      const fileBuffer = fs.readFileSync(filePath);
      let cleanedText = '';
      let totalPages = 1;

      try {
        const pdfData = await pdfParse(fileBuffer);
        cleanedText = cleanExtractedText(pdfData.text || '');
        totalPages = pdfData.numpages || 1;
      } catch (pdfErr) {
        // Attempt fallback stream recovery on damaged PDF
        const fallbackText = extractTextFromCorruptPdf(fileBuffer);
        if (fallbackText && fallbackText.length >= 20) {
          cleanedText = fallbackText;
          console.log('       ℹ️ Recovered text via direct stream decompression.');
        } else {
          console.warn(`       ℹ️ Notice: Damaged PDF structure (${pdfErr.message?.slice(0, 40)}...). Skipping.`);
          skippedCorruptedFiles++;
          continue;
        }
      }

      if (!cleanedText || cleanedText.length < 20) {
        console.warn(`       ℹ️ Notice: Insufficient text content (${cleanedText.length} chars). Skipping.`);
        skippedCorruptedFiles++;
        continue;
      }

      // Step B: Chunk Text
      const textChunks = recursiveCharacterChunk(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP);
      console.log(`       ↳ Pages: ${totalPages} | Raw chars: ${cleanedText.length} | Generated chunks: ${textChunks.length}`);

      if (textChunks.length === 0) {
        console.warn('       ⚠️ Notice: No valid text chunks produced. Skipping.');
        skippedCorruptedFiles++;
        continue;
      }

      // Step C: Generate Embeddings locally via Hugging Face ONNX
      const embeddings = [];
      for (let i = 0; i < textChunks.length; i++) {
        const output = await extractor(textChunks[i], { pooling: 'mean', normalize: true });
        const rawVector = Array.from(output.data);
        embeddings.push(padTo768(rawVector));
      }
      console.log(`       ↳ Local Embeddings: ${embeddings.length}/${textChunks.length} chunks generated (384 -> 768 dim).`);

      // Step D: Prepare DB Records
      const recordsToInsert = textChunks.map((chunk, idx) => ({
        file_name: fileName,
        chunk_index: idx,
        content: chunk,
        metadata: {
          file_name: fileName,
          chunk_index: idx,
          total_chunks: textChunks.length,
          total_pages: totalPages,
          file_size_bytes: fileStats.size,
          char_length: chunk.length,
          sector_category: sector,
          embedding_model: 'Xenova/all-MiniLM-L6-v2',
        },
        embedding: embeddings[idx],
        created_at: new Date().toISOString(),
      }));

      // Step E: Supabase Operations with Retry
      // 1. Delete prior chunks for this file
      await supabaseOperationWithRetry(
        () => supabase.from('document_chunks').delete().eq('file_name', fileName),
        'Chunk Deduplication',
        3,
        1500
      );

      // 2. Bulk insert in batches of DB_INSERT_BATCH_SIZE (50)
      for (let i = 0; i < recordsToInsert.length; i += DB_INSERT_BATCH_SIZE) {
        const batchSlice = recordsToInsert.slice(i, i + DB_INSERT_BATCH_SIZE);
        await supabaseOperationWithRetry(
          () => supabase.from('document_chunks').insert(batchSlice),
          'Bulk Insert Chunks',
          4,
          2000
        );
      }

      totalChunksIngested += recordsToInsert.length;
      successfulFiles++;
      console.log(`       ✅ Ingested ${recordsToInsert.length} chunks & local embeddings into Supabase.\n`);
    } catch (err) {
      failedFiles++;
      console.error(`       ❌ Failed processing "${fileName}": ${err.message}\n`);
    }
  }

  // ── 6. Final Summary Report ────────────────────────────────────────────────
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=================================================================');
  console.log('📊 Local Ingestion Pipeline Execution Summary');
  console.log('=================================================================');
  console.log(`Total PDF Documents Found      : ${pdfFiles.length}`);
  console.log(`Newly Ingested in this Run     : ${successfulFiles}`);
  console.log(`Already Ingested (Skipped)     : ${skippedAlreadyIngested}`);
  console.log(`Corrupted/Empty PDFs (Skipped) : ${skippedCorruptedFiles}`);
  console.log(`Failed Files                   : ${failedFiles}`);
  console.log(`New Chunks & Vectors Stored    : ${totalChunksIngested}`);
  console.log(`Vector Dimension               : ${TARGET_EMBEDDING_DIM} (pgvector cosine ops)`);
  console.log(`Model Used                     : Xenova/all-MiniLM-L6-v2 (Local Node.js)`);
  console.log(`Total Execution Time           : ${durationSec}s`);
  console.log('=================================================================\n');
}

// Execute pipeline
runPipeline().catch((fatalErr) => {
  console.error('\n💥 Fatal Pipeline Error:', fatalErr);
  process.exit(1);
});
