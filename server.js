// ============================================================
// Gramin Udyam Sahayak – Express Backend Server
// Endpoints: POST /api/submit-application, POST /api/generate-advisory
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import advisoryRouter from './routes/advisory.js';
import localdataRouter from './routes/localdata.js';

dotenv.config();

// ── Environment validation ──────────────────────────────────
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

// ── SDK Initialization ──────────────────────────────────────
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: { persistSession: false },
});
const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Multer memory storage for in-memory audio processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Local fallback store for applications if Supabase is offline or paused
const localApplications = [];

// ── Express Setup ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Gramin Udyam Sahayak API is running.' });
});

// ─────────────────────────────────────────────────────────────
// POST /api/submit-application
// Receives the loan application payload, validates fields,
// attempts Supabase insert (with timeout), and falls back gracefully.
// ─────────────────────────────────────────────────────────────
app.post('/api/submit-application', async (req, res) => {
  try {
    const {
      applicant_name,
      mobile_number,
      location,
      sector,
      margin_money,
      total_project_size,
      loan_eligibility,
      scheme_type,
    } = req.body;

    // ── Field Validation ──────────────────────────────────
    const errors = [];

    if (!applicant_name || typeof applicant_name !== 'string' || applicant_name.trim().length < 2) {
      errors.push('applicant_name is required (min 2 characters).');
    }
    if (!mobile_number || !/^[0-9]{10}$/.test(mobile_number)) {
      errors.push('mobile_number must be a valid 10-digit number.');
    }
    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      errors.push('location is required.');
    }
    if (!sector || typeof sector !== 'string') {
      errors.push('sector is required.');
    }
    if (margin_money === undefined || margin_money === null || Number(margin_money) < 0) {
      errors.push('margin_money must be a non-negative number.');
    }
    if (total_project_size === undefined || Number(total_project_size) <= 0) {
      errors.push('total_project_size must be a positive number.');
    }
    if (loan_eligibility === undefined || Number(loan_eligibility) <= 0) {
      errors.push('loan_eligibility must be a positive number.');
    }
    if (!scheme_type || !['Micro Finance', 'Term Loan'].includes(scheme_type)) {
      errors.push('scheme_type must be "Micro Finance" or "Term Loan".');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const applicationRecord = {
      applicant_name: applicant_name.trim(),
      mobile_number,
      location: location.trim(),
      sector: sector.trim(),
      margin_money: Number(margin_money),
      total_project_size: Number(total_project_size),
      loan_eligibility: Number(loan_eligibility),
      scheme_type,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    // ── Attempt Insert into Supabase with Timeout ─────────
    let supabaseResult = null;
    try {
      const insertPromise = supabase
        .from('loan_applications')
        .insert([applicationRecord])
        .select()
        .single();

      // Set a 3.5s timeout on Supabase call
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase request timed out (project may be paused)')), 3500)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);
      if (error) {
        console.warn('Supabase DB notice:', error.message);
      } else if (data) {
        supabaseResult = data;
      }
    } catch (dbErr) {
      console.warn('Supabase connection notice (falling back to local session store):', dbErr.message);
    }

    // ── If Supabase succeeded, return Supabase record ─────
    if (supabaseResult && supabaseResult.id) {
      return res.status(201).json({
        success: true,
        message: 'Loan application submitted successfully!',
        data: {
          applicationId: supabaseResult.id,
          applicantName: supabaseResult.applicant_name,
          schemeType: supabaseResult.scheme_type,
          status: supabaseResult.status,
          createdAt: supabaseResult.created_at,
          source: 'Supabase Cloud DB',
        },
      });
    }

    // ── Fallback: Local in-memory application store ───────
    const fallbackId = `GUS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const localRecord = {
      ...applicationRecord,
      id: fallbackId,
    };
    localApplications.push(localRecord);

    return res.status(201).json({
      success: true,
      message: 'Loan application registered successfully!',
      data: {
        applicationId: fallbackId,
        applicantName: localRecord.applicant_name,
        schemeType: localRecord.scheme_type,
        status: localRecord.status,
        createdAt: localRecord.created_at,
        source: 'Local Enterprise Session Store',
      },
    });
  } catch (err) {
    console.error('Unexpected error in /api/submit-application:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error.',
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Advisory RAG Router: POST /api/generate-advisory
// (Deterministic Financial Calculations + Supabase pgvector + Gemini RAG)
// ─────────────────────────────────────────────────────────────
app.use('/api', advisoryRouter);
app.use('/api', localdataRouter);


// ─────────────────────────────────────────────────────────────
// POST /api/transcribe-voice
// Receives in-memory audio upload (form field: 'audio'),
// transcribes with OpenAI Whisper (whisper-1),
// and extracts { location, marginMoney, businessCategory } using Gemini.
// ─────────────────────────────────────────────────────────────
app.post('/api/transcribe-voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided in request. Please upload audio under field "audio".',
      });
    }

    console.log(`\n🎤 [Voice Upload Received]: ${req.file.size} bytes (${req.file.mimetype || 'audio/webm'})`);

    let transcriptionText = '';

    // 1. Transcribe with OpenAI Whisper
    if (openai) {
      try {
        const audioFile = await toFile(req.file.buffer, 'recording.webm', {
          type: req.file.mimetype || 'audio/webm',
        });
        const whisperResponse = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
        });
        transcriptionText = whisperResponse.text?.trim() || '';
        console.log('🎙️ [OpenAI Whisper-1 Transcript]:', transcriptionText);
      } catch (whisperErr) {
        console.warn('OpenAI Whisper transcription failed:', whisperErr.message);
      }
    } else {
      console.log('ℹ️ OPENAI_API_KEY not set in .env. Using Gemini direct audio transcription fallback...');
    }

    // Direct Gemini Audio Fallback if OpenAI key is not set or Whisper failed
    if (!transcriptionText) {
      const base64Audio = req.file.buffer.toString('base64');
      const audioMimeType = req.file.mimetype && req.file.mimetype.startsWith('audio/')
        ? req.file.mimetype
        : 'audio/webm';

      const directAudioPrompt = `Listen carefully to this audio recording from an Indian rural micro-entrepreneur or loan applicant.
1. Transcribe the spoken text accurately (Hindi, English, or Hinglish).
2. Extract these 3 key fields:
   - "location": Village/Block/District name (default 'Rampur, Block 3' if not specified)
   - "marginMoney": Numerical amount in INR of borrower contribution (default 14000 if not specified)
   - "businessCategory": One of exactly: 'Dairy & Livestock', 'Handloom & Textiles', 'Grocery & Retail', 'Agro-Processing', 'Handicrafts' (default 'Dairy & Livestock')

Return ONLY a valid JSON object matching:
{
  "transcription": "<exact spoken transcript>",
  "location": "<location string>",
  "marginMoney": <number>,
  "businessCategory": "<category string>"
}`;

      for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash']) {
        try {
          const geminiAudioRes = await genai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: directAudioPrompt },
                  {
                    inlineData: {
                      mimeType: audioMimeType,
                      data: base64Audio,
                    },
                  },
                ],
              },
            ],
          });
          const raw = geminiAudioRes.text?.trim() || '';
          let jsonString = raw;
          const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (fenceMatch) jsonString = fenceMatch[1].trim();

          const parsed = JSON.parse(jsonString);
          if (parsed && typeof parsed === 'object') {
            const validCategories = [
              'Dairy & Livestock',
              'Handloom & Textiles',
              'Grocery & Retail',
              'Agro-Processing',
              'Handicrafts',
            ];
            const matchedCategory = validCategories.find(
              (c) => c.toLowerCase() === (parsed.businessCategory || '').toLowerCase()
            ) || 'Dairy & Livestock';

            console.log('🤖 [Gemini Audio Direct Result]:', parsed);
            return res.json({
              success: true,
              transcript: parsed.transcription || 'Voice recording processed',
              data: {
                location: String(parsed.location || 'Rampur, Block 3').trim(),
                marginMoney: Number(parsed.marginMoney) > 0 ? Number(parsed.marginMoney) : 14000,
                businessCategory: matchedCategory,
              },
            });
          }
        } catch (gemAudioErr) {
          console.warn(`Gemini audio processing with ${model} failed:`, gemAudioErr.message);
        }
      }
    }

    // 2. Extract values using Gemini from the Whisper transcription
    if (transcriptionText) {
      const extractionPrompt = `You are a strict data extraction system for the Indian rural credit advisory portal "Gramin Udyam Sahayak".
The user spoke the following query:
"${transcriptionText}"

Extract the following three values from the text and return ONLY a valid JSON object:
1. "location": The village, block, district, or town mentioned (e.g. 'Rampur, Block 3' or 'Anand, Gujarat'). If none mentioned, return 'Rampur, Block 3'.
2. "marginMoney": The numerical borrower contribution / margin money amount in Indian Rupees (e.g., if user says '15000' or 'bees hazar' or '25 thousand', return 15000, 20000, or 25000). Return only the number. If none mentioned, return 14000.
3. "businessCategory": MUST BE EXACTLY ONE OF:
   - "Dairy & Livestock" (e.g. dairy, milk, cows, buffalo, livestock, pashupalan)
   - "Handloom & Textiles" (e.g. weaving, clothes, sari, fabric, garments, bunkar, silai)
   - "Grocery & Retail" (e.g. kirana shop, grocery store, general retail)
   - "Agro-Processing" (e.g. flour mill, spice processing, oil expeller, grain milling)
   - "Handicrafts" (e.g. pottery, wooden crafts, clay, bamboo, hastshilp)
   Choose the best match. If not clearly specified, default to "Dairy & Livestock".

Return ONLY a valid JSON object matching this schema:
{
  "location": string,
  "marginMoney": number,
  "businessCategory": string
}`;

      let rawExtractionText = '';
      for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'gemini-3.7-flash']) {
        try {
          const extractRes = await genai.models.generateContent({
            model,
            contents: extractionPrompt,
          });
          rawExtractionText = extractRes.text?.trim() || '';
          if (rawExtractionText) break;
        } catch (extErr) {
          console.warn(`Gemini extraction with ${model} failed:`, extErr.message);
        }
      }

      let parsedResult = {
        location: 'Rampur, Block 3',
        marginMoney: 14000,
        businessCategory: 'Dairy & Livestock',
      };

      if (rawExtractionText) {
        let jsonStr = rawExtractionText;
        const fenceMatch = rawExtractionText.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenceMatch) {
          jsonStr = fenceMatch[1].trim();
        } else {
          const firstBrace = rawExtractionText.indexOf('{');
          const lastBrace = rawExtractionText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = rawExtractionText.slice(firstBrace, lastBrace + 1).trim();
          }
        }
        try {
          parsedResult = JSON.parse(jsonStr);
        } catch (jsonErr) {
          console.warn('Failed to parse Gemini extraction JSON:', jsonErr.message);
        }
      }

      const validCategories = [
        'Dairy & Livestock',
        'Handloom & Textiles',
        'Grocery & Retail',
        'Agro-Processing',
        'Handicrafts',
      ];
      const finalCategory = validCategories.find(
        (c) => c.toLowerCase() === (parsedResult.businessCategory || '').toLowerCase()
      ) || 'Dairy & Livestock';

      const finalData = {
        location: String(parsedResult.location || 'Rampur, Block 3').trim(),
        marginMoney: Number(parsedResult.marginMoney) > 0 ? Number(parsedResult.marginMoney) : 14000,
        businessCategory: finalCategory,
      };

      console.log('✅ [Voice Autofill Extracted Data]:', finalData);

      return res.json({
        success: true,
        transcript: transcriptionText,
        data: finalData,
      });
    }

    return res.status(502).json({
      success: false,
      error: 'Unable to transcribe or extract parameters from audio. Please try again.',
    });
  } catch (err) {
    console.error('Unexpected error in /api/transcribe-voice:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error while processing voice recording.',
    });
  }
});

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Gramin Udyam Sahayak API Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
