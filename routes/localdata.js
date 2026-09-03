// =============================================================================
// Gramin Udyam Sahayak – Hyper-Local Data Routes
// Endpoints: GET /api/mandi-prices, GET /api/location-lookup, GET /api/nearby-businesses
// =============================================================================

import { Router } from 'express';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// ── Helper: Fetch with timeout ───────────────────────────────────────────────
function fetchWithTimeout(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.get(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'User-Agent': 'GraminUdyamSahayak/1.0' },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(body) });
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
  });
}

// ── Fallback Mandi Price Data (District-wise) ────────────────────────────────
const MANDI_FALLBACK = {
  milk: { minPrice: 48, maxPrice: 62, modalPrice: 55, unit: 'per Liter' },
  wheat: { minPrice: 2200, maxPrice: 2800, modalPrice: 2500, unit: 'per Quintal' },
  rice: { minPrice: 2800, maxPrice: 3600, modalPrice: 3200, unit: 'per Quintal' },
  mustard: { minPrice: 5200, maxPrice: 6800, modalPrice: 6000, unit: 'per Quintal' },
  groundnut: { minPrice: 5500, maxPrice: 7200, modalPrice: 6400, unit: 'per Quintal' },
  cotton: { minPrice: 6200, maxPrice: 7800, modalPrice: 7000, unit: 'per Quintal' },
  dal: { minPrice: 6800, maxPrice: 8500, modalPrice: 7600, unit: 'per Quintal' },
  turmeric: { minPrice: 8000, maxPrice: 12000, modalPrice: 9500, unit: 'per Quintal' },
  jaggery: { minPrice: 3800, maxPrice: 5200, modalPrice: 4500, unit: 'per Quintal' },
  ghee: { minPrice: 450, maxPrice: 580, modalPrice: 520, unit: 'per Kg' },
  paneer: { minPrice: 320, maxPrice: 420, modalPrice: 360, unit: 'per Kg' },
};

// ── GET /api/mandi-prices ────────────────────────────────────────────────────
router.get('/mandi-prices', async (req, res) => {
  try {
    const { commodity = 'wheat', district = '' } = req.query;
    const commodityKey = String(commodity).toLowerCase().trim();

    // Attempt to fetch from e-NAM / Agmarknet open data
    let liveData = null;
    try {
      const apiUrl = `https://enam.gov.in/web/Ajax/arrivals_data?language=en&stateName=&districtName=${encodeURIComponent(district)}&mandiName=&commodityName=${encodeURIComponent(commodity)}&fromDate=&toDate=`;
      const result = await fetchWithTimeout(apiUrl, 6000);
      if (result.ok && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const latest = result.data[0];
        liveData = {
          commodity: latest.commodity || commodity,
          district: latest.district || district,
          minPrice: Number(latest.min_price) || 0,
          maxPrice: Number(latest.max_price) || 0,
          modalPrice: Number(latest.modal_price) || 0,
          marketName: latest.market || 'Local APMC',
          date: latest.arrival_date || new Date().toISOString().split('T')[0],
          source: 'e-NAM Live Data',
        };
      }
    } catch (apiErr) {
      console.warn('e-NAM API unavailable, using fallback:', apiErr.message);
    }

    if (liveData) {
      return res.json({ success: true, data: liveData });
    }

    // Fallback to hardcoded data
    const fallback = MANDI_FALLBACK[commodityKey] || MANDI_FALLBACK.wheat;
    return res.json({
      success: true,
      data: {
        commodity: commodityKey,
        district: district || 'National Average',
        minPrice: fallback.minPrice,
        maxPrice: fallback.maxPrice,
        modalPrice: fallback.modalPrice,
        unit: fallback.unit,
        marketName: 'Nearest APMC Mandi',
        date: new Date().toISOString().split('T')[0],
        source: 'Offline Benchmark Data',
      },
    });
  } catch (err) {
    console.error('Error in /api/mandi-prices:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Fallback PIN Code Data ───────────────────────────────────────────────────
const PIN_FALLBACK = {
  '382721': { state: 'Gujarat', district: 'Ahmedabad', block: 'Daskroi', postOffice: 'Bavla' },
  '274001': { state: 'Uttar Pradesh', district: 'Deoria', block: 'Deoria Sadar', postOffice: 'Deoria' },
  '388001': { state: 'Gujarat', district: 'Anand', block: 'Anand', postOffice: 'Anand H.O' },
  '400001': { state: 'Maharashtra', district: 'Mumbai', block: 'Fort', postOffice: 'Mumbai GPO' },
  '110001': { state: 'Delhi', district: 'Central Delhi', block: 'Central', postOffice: 'New Delhi GPO' },
  '302001': { state: 'Rajasthan', district: 'Jaipur', block: 'Jaipur', postOffice: 'Jaipur GPO' },
};

// ── GET /api/location-lookup ─────────────────────────────────────────────────
router.get('/location-lookup', async (req, res) => {
  try {
    const { pincode } = req.query;
    if (!pincode || !/^\d{6}$/.test(String(pincode))) {
      return res.status(400).json({ success: false, error: 'Please provide a valid 6-digit Indian PIN code.' });
    }

    const pin = String(pincode);

    // Attempt India Post API
    let liveData = null;
    try {
      const result = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${pin}`, 5000);
      if (result.ok && Array.isArray(result.data) && result.data[0]?.Status === 'Success') {
        const postOffices = result.data[0].PostOffice;
        if (postOffices && postOffices.length > 0) {
          const po = postOffices[0];
          liveData = {
            pincode: pin,
            state: po.State,
            district: po.District,
            block: po.Block || po.Division,
            postOffice: po.Name,
            region: po.Region,
            allPostOffices: postOffices.map((p) => ({
              name: p.Name,
              type: p.BranchType,
              deliveryStatus: p.DeliveryStatus,
            })),
            source: 'India Post API',
          };
        }
      }
    } catch (apiErr) {
      console.warn('India Post API unavailable, using fallback:', apiErr.message);
    }

    if (liveData) {
      return res.json({ success: true, data: liveData });
    }

    // Fallback
    const fallback = PIN_FALLBACK[pin];
    if (fallback) {
      return res.json({
        success: true,
        data: {
          pincode: pin,
          state: fallback.state,
          district: fallback.district,
          block: fallback.block,
          postOffice: fallback.postOffice,
          source: 'Offline Lookup Table',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        pincode: pin,
        state: 'Unknown',
        district: 'Unknown',
        block: 'Unknown',
        postOffice: 'Not Found',
        source: 'No Match',
      },
    });
  } catch (err) {
    console.error('Error in /api/location-lookup:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sector to OSM tag mapping ────────────────────────────────────────────────
const SECTOR_OSM_TAGS = {
  'Dairy & Livestock': { tag: 'shop=dairy', fallbackCount: 3 },
  'Handloom & Textiles': { tag: 'craft=weaver', fallbackCount: 2 },
  'Grocery & Retail': { tag: 'shop=convenience', fallbackCount: 8 },
  'Agro-Processing': { tag: 'landuse=industrial', fallbackCount: 2 },
  'Handicrafts': { tag: 'craft=pottery', fallbackCount: 1 },
};

// ── GET /api/nearby-businesses ───────────────────────────────────────────────
router.get('/nearby-businesses', async (req, res) => {
  try {
    const { lat, lng, category = 'Dairy & Livestock', radius = 5 } = req.query;
    const radiusKm = Number(radius) || 5;
    const radiusMeters = radiusKm * 1000;
    const sectorInfo = SECTOR_OSM_TAGS[String(category)] || SECTOR_OSM_TAGS['Dairy & Livestock'];

    // Attempt OpenStreetMap Overpass API if coordinates provided
    if (lat && lng) {
      try {
        const [key, value] = sectorInfo.tag.split('=');
        const overpassQuery = `[out:json][timeout:8];(node["${key}"="${value}"](around:${radiusMeters},${lat},${lng});way["${key}"="${value}"](around:${radiusMeters},${lat},${lng}););out center;`;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

        const result = await fetchWithTimeout(overpassUrl, 8000);
        if (result.ok && result.data && result.data.elements) {
          const businesses = result.data.elements.slice(0, 20).map((el) => ({
            name: el.tags?.name || `${category} Unit`,
            type: el.tags?.shop || el.tags?.craft || el.tags?.landuse || category,
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon,
          }));

          return res.json({
            success: true,
            data: {
              totalCount: result.data.elements.length,
              category,
              radiusKm,
              businesses,
              source: 'OpenStreetMap Overpass',
            },
          });
        }
      } catch (osmErr) {
        console.warn('Overpass API unavailable, using fallback:', osmErr.message);
      }
    }

    // Fallback estimates
    return res.json({
      success: true,
      data: {
        totalCount: sectorInfo.fallbackCount,
        category,
        radiusKm,
        businesses: [],
        densityIndex: sectorInfo.fallbackCount > 5 ? 'MEDIUM' : 'LOW',
        source: 'Estimated Regional Benchmark',
      },
    });
  } catch (err) {
    console.error('Error in /api/nearby-businesses:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
