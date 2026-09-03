import React, { useState, useMemo, useRef } from 'react';
import {
  MapPin,
  HelpCircle,
  Globe,
  User,
  CheckCircle2,
  Users,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  Download,
  ArrowRight,
  Sparkles,
  ChevronDown,
  X,
  FileCheck2,
  PhoneCall,
  Info,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  VolumeX,
  FileText,
} from 'lucide-react';
import RepaymentSchedule from './RepaymentSchedule';
import ViabilityDashboard from './ViabilityDashboard';
import DPRExport from './DPRExport';

// Category-specific mock data dictionary (with Dairy & Livestock exactly matching the UI mockup)
interface CategoryAdvisory {
  customers: string;
  customerRadius: string;
  opportunities: string[];
  swot: {
    s: string;
    w: string;
    o: string;
    t: string;
  };
  risks: { text: string; severe?: boolean }[];
  competitorDensity: 'Low' | 'Medium' | 'High';
  densityPercentage: number;
  benchmarkPrice: string;
  benchmarkUnit: string;
  localAvg: string;
}

const CATEGORY_DATA: Record<string, CategoryAdvisory> = {
  'Dairy & Livestock': {
    customers: '1,250+',
    customerRadius: '5km radius',
    opportunities: [
      'High demand for pasteurized products.',
      'Low penetration of organized retail.',
      'Government subsidy on chilling units.',
    ],
    swot: {
      s: 'Local Raw Material',
      w: 'Power Instability',
      o: 'Growing Urban Demand',
      t: 'Seasonal Supply Drop',
    },
    risks: [
      { text: 'Summer Water Scarcity', severe: true },
      { text: 'Transport Logistics', severe: false },
    ],
    competitorDensity: 'Low',
    densityPercentage: 25,
    benchmarkPrice: '₹ 55–60',
    benchmarkUnit: '/ Liter',
    localAvg: '₹50',
  },
  'Handloom & Textiles': {
    customers: '850+',
    customerRadius: '8km radius',
    opportunities: [
      'Rising preference for authentic Khadi and handloom.',
      'Export potential via State Cooperative emporiums.',
      'Zero GST on select traditional woven items.',
    ],
    swot: {
      s: 'Generational Craft Skill',
      w: 'Dyeing Infrastructure',
      o: 'E-commerce Market Access',
      t: 'Synthetic Yarn Competition',
    },
    risks: [
      { text: 'Yarn Price Volatility', severe: true },
      { text: 'Slow Order Turnaround', severe: false },
    ],
    competitorDensity: 'Low',
    densityPercentage: 30,
    benchmarkPrice: '₹ 850–1,200',
    benchmarkUnit: '/ Piece',
    localAvg: '₹750',
  },
  'Grocery & Retail': {
    customers: '2,100+',
    customerRadius: '3km radius',
    opportunities: [
      'High daily FMCG consumption across neighboring hamlets.',
      'Opportunity for digital payment (UPI) cashbacks.',
      'Bulk purchase discounts from regional APMC wholesale.',
    ],
    swot: {
      s: 'Prime Road Connectivity',
      w: 'Credit-based Customer Sales',
      o: 'Value-add Packaged Goods',
      t: 'Wholesale Price Spikes',
    },
    risks: [
      { text: 'Working Capital Lock-in', severe: true },
      { text: 'Perishables Expiry', severe: false },
    ],
    competitorDensity: 'Medium',
    densityPercentage: 55,
    benchmarkPrice: '12–18%',
    benchmarkUnit: 'Gross Margin',
    localAvg: '10%',
  },
  'Agro-Processing': {
    customers: '1,600+',
    customerRadius: '10km radius',
    opportunities: [
      'Abundant post-harvest pulses and oilseed availability.',
      'PMFME scheme capital subsidy up to 35%.',
      'Direct procurement by regional millers.',
    ],
    swot: {
      s: 'Direct Farmgate Proximity',
      w: 'Storage Warehouse Lack',
      o: 'Brand Packaging Potential',
      t: 'Monsoon Crop Irregularity',
    },
    risks: [
      { text: 'Pest Infestation Risk', severe: true },
      { text: 'Machinery Maintenance', severe: false },
    ],
    competitorDensity: 'Low',
    densityPercentage: 20,
    benchmarkPrice: '₹ 110–135',
    benchmarkUnit: '/ Kg Processed',
    localAvg: '₹95',
  },
  'Handicrafts': {
    customers: '600+',
    customerRadius: '15km radius',
    opportunities: [
      'High tourist inflow during festive and harvest seasons.',
      'ODOP (One District One Product) government support.',
      'Direct corporate gifting orders.',
    ],
    swot: {
      s: 'Unique Cultural Heritage',
      w: 'Seasonal Tourist Demand',
      o: 'Exhibition Stall Allotments',
      t: 'Cheap Plastic Substitutes',
    },
    risks: [
      { text: 'Raw Material Seasonality', severe: true },
      { text: 'Intermediary Margins', severe: false },
    ],
    competitorDensity: 'Low',
    densityPercentage: 18,
    benchmarkPrice: '₹ 350–500',
    benchmarkUnit: '/ Article',
    localAvg: '₹300',
  },
};

// Backend API base URL (proxied by Vite in dev)
const API_BASE = '/api';

export default function App() {
  // 1. Core State Variables
  const [location, setLocation] = useState<string>('Rampur, Block 3');
  const [marginMoney, setMarginMoney] = useState<number | string>(14000);
  const [businessCategory, setBusinessCategory] = useState<string>('Dairy & Livestock');

  // UI Interactive States
  const [language, setLanguage] = useState<'EN' | 'HI' | 'GU'>('EN');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Advisory API States
  const [advisoryData, setAdvisoryData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice Auto-fill States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 2. Dynamic Financial Math Logic
  const parsedMargin = useMemo(() => {
    if (marginMoney === '' || isNaN(Number(marginMoney))) return 0;
    return Math.max(0, Number(marginMoney));
  }, [marginMoney]);

  // totalProjectSize = marginMoney / 0.10
  const totalProjectSize = useMemo(() => {
    return parsedMargin * 10;
  }, [parsedMargin]);

  // Scheme Routing Logic (harmonized with backend advisory.js)
  const isMicroFinance = totalProjectSize <= 140000;
  const schemeExceeded = totalProjectSize > 5000000;

  // maxLoanEligibility with NBCFDC caps
  const maxLoanEligibility = useMemo(() => {
    if (schemeExceeded) return 4500000;
    if (isMicroFinance) return Math.min(totalProjectSize * 0.9, 125000);
    return Math.min(totalProjectSize * 0.9, 4500000);
  }, [totalProjectSize, isMicroFinance, schemeExceeded]);

  const activeSchemeName = isMicroFinance
    ? 'Active Scheme : Micro Finance Scheme'
    : 'Active Scheme : Term Loan Scheme';
  const schemeCapTag = isMicroFinance ? '≤ ₹1.40 Lakh' : '> ₹1.40 Lakh';

  // Repayment parameters (harmonized: 6.5% / 8.0%, 3 / 6 month moratorium)
  const gracePeriod = isMicroFinance ? '3 Months' : '6 Months';
  const tenureMonths = isMicroFinance ? 36 : 84;
  const annualInterestRate = isMicroFinance ? 0.065 : 0.08;
  const gracePeriodMonths = isMicroFinance ? 3 : 6;

  // Estimated EMI using standard reducing balance loan calculation
  const calculatedEMI = useMemo(() => {
    if (maxLoanEligibility <= 0) return 0;
    const monthlyRate = annualInterestRate / 12;
    const n = tenureMonths;
    const emi =
      (maxLoanEligibility * monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1);
    return Math.round(emi);
  }, [maxLoanEligibility, annualInterestRate, tenureMonths]);

  // Helper formatter for Indian Rupees
  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Active advisory data: use live API data if available, otherwise fallback to default
  const activeAdvisory = advisoryData || CATEGORY_DATA[businessCategory] || CATEGORY_DATA['Dairy & Livestock'];

  // Handle plan generation trigger — calls backend /api/generate-advisory
  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Input validation
    if (!location || !location.trim()) {
      setErrorMessage('Please enter a valid location.');
      setShowSuccessToast('⚠️ Please enter a valid location.');
      return;
    }

    if (marginMoney === '' || Number(marginMoney) <= 0 || isNaN(Number(marginMoney))) {
      setErrorMessage('Please enter a valid margin contribution (> 0).');
      setShowSuccessToast('⚠️ Please enter a valid margin contribution.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    console.log(
      '%c🤖 [Gramin Udyam Sahayak] Generating AI Advisory...',
      'color: #185E20; font-weight: bold; font-size: 13px;'
    );
    console.log('📍 Location:', location.trim());
    console.log('💰 Margin Money:', Number(marginMoney));
    console.log('🏷️ Sector / Category:', businessCategory.trim());

    try {
      const res = await fetch(`${API_BASE}/generate-advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: location.trim(),
          marginMoney: Number(marginMoney),
          businessCategory: businessCategory.trim(),
          language: language,
        }),
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = { success: false, error: `Server returned status ${res.status}` };
      }

      console.log(
        '%c📥 [AI Advisory Response Received from Backend]:',
        'color: #007ACC; font-weight: bold; font-size: 13px;',
        json
      );

      if (json.success && json.data) {
        setAdvisoryData(json.data);
        setShowSuccessToast('AI-generated feasibility & financial plan loaded!');
        setTimeout(() => setShowSuccessToast(null), 3500);
      } else {
        const errorMsg = json.error || 'Failed to generate advisory. Using offline data.';
        setErrorMessage(errorMsg);
        setShowSuccessToast(`⚠️ ${errorMsg}`);
        setTimeout(() => setShowSuccessToast(null), 3500);
      }
    } catch (err: any) {
      console.error('❌ Advisory API call failed:', err);
      const errorMsg = err?.message || 'Network error. Showing offline advisory data.';
      setErrorMessage(errorMsg);
      setShowSuccessToast(`⚠️ ${errorMsg}`);
      setTimeout(() => setShowSuccessToast(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Voice-to-Text Auto-Fill Handlers ───────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        // Stop all audio tracks to release microphone hardware immediately
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size === 0) {
          setShowSuccessToast('⚠️ No audio captured. Please try speaking again.');
          setTimeout(() => setShowSuccessToast(null), 3500);
          return;
        }

        setIsTranscribing(true);
        setShowSuccessToast('🎙️ Transcribing & extracting parameters...');

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-input.webm');

          const res = await fetch(`${API_BASE}/transcribe-voice`, {
            method: 'POST',
            body: formData,
          });

          let json: any = {};
          try {
            json = await res.json();
          } catch {
            json = { success: false, error: `Server error (${res.status})` };
          }

          if (json.success && json.data) {
            console.log('🎤 [Voice Auto-Fill Result]:', json);
            if (json.data.location) {
              setLocation(json.data.location);
            }
            if (json.data.marginMoney !== undefined && json.data.marginMoney !== null) {
              setMarginMoney(Number(json.data.marginMoney));
            }
            if (json.data.businessCategory) {
              setBusinessCategory(json.data.businessCategory);
            }

            setShowSuccessToast(
              `✨ Auto-filled: "${json.transcript ? json.transcript.slice(0, 40) + '...' : 'Data updated'}"`
            );
            setTimeout(() => setShowSuccessToast(null), 4500);
          } else {
            console.warn('Voice auto-fill failed:', json.error);
            setShowSuccessToast(`⚠️ ${json.error || 'Could not understand audio. Please retry.'}`);
            setTimeout(() => setShowSuccessToast(null), 4000);
          }
        } catch (err) {
          console.error('Voice transcription request error:', err);
          setShowSuccessToast('⚠️ Voice server communication error. Please try again.');
          setTimeout(() => setShowSuccessToast(null), 4000);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setShowSuccessToast('🔴 Listening... Click mic again when done speaking.');
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setShowSuccessToast('⚠️ Microphone permission denied. Please allow microphone access.');
      setTimeout(() => setShowSuccessToast(null), 4000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle Official DPR PDF Export / Print
  const handleDownloadDPR = () => {
    window.print();
  };

  // Text-to-Speech: Read feasibility report aloud
  const toggleSpeech = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const advisory = activeAdvisory;
    const reportText = [
      `Feasibility Report for ${businessCategory} in ${location}.`,
      `Estimated local customers: ${advisory.customers}.`,
      `Opportunities: ${(advisory.opportunities || []).join('. ')}.`,
      `SWOT: Strength is ${advisory.swot?.s}. Weakness is ${advisory.swot?.w}. Opportunity is ${advisory.swot?.o}. Threat is ${advisory.swot?.t}.`,
      `Risks: ${(advisory.risks || []).map((r: any) => r.text).join('. ')}.`,
      `Suggested pricing: ${advisory.benchmarkPrice} ${advisory.benchmarkUnit}.`,
      `Your loan eligibility is ${formatINR(advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility)} rupees.`,
      `Monthly EMI is approximately ${formatINR(advisoryData?.financialSummary?.estimatedEMI || calculatedEMI)} rupees.`,
    ].join(' ');

    const utterance = new SpeechSynthesisUtterance(reportText);
    utterance.lang = language === 'HI' ? 'hi-IN' : language === 'GU' ? 'gu-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  // Handle loan submit — calls backend /api/submit-application
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        applicant_name: applicantName.trim(),
        mobile_number: contactNumber.trim(),
        location: location.trim(),
        sector: businessCategory,
        margin_money: parsedMargin,
        total_project_size: totalProjectSize,
        loan_eligibility: maxLoanEligibility,
        scheme_type: isMicroFinance ? 'Micro Finance' : 'Term Loan',
      };

      const res = await fetch(`${API_BASE}/submit-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = { success: false, error: `Server error (${res.status})` };
      }

      setIsSubmitting(false);
      setShowLoanModal(false);

      if (json.success) {
        setShowSuccessToast(
          `✅ Application submitted! ID: ${json.data.applicationId?.slice(0, 8)}... for ${applicantName || 'Entrepreneur'} under ${
            isMicroFinance ? 'Micro Finance Scheme' : 'Term Loan Scheme'
          }`
        );
      } else {
        const errorMsg = json.errors ? json.errors.join(', ') : json.error || 'Submission failed.';
        setShowSuccessToast(`⚠️ ${errorMsg}`);
      }
      setTimeout(() => setShowSuccessToast(null), 5000);
    } catch (err) {
      console.error('Loan submission failed:', err);
      setIsSubmitting(false);
      setShowLoanModal(false);
      setShowSuccessToast('⚠️ Network error. Please check your connection and try again.');
      setTimeout(() => setShowSuccessToast(null), 4500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFB] text-[#191C1D] antialiased">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div
          id="toast-notification"
          className="fixed top-20 right-4 md:right-8 z-50 bg-[#185E20] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all transform translate-y-0"
        >
          <CheckCircle2 className="w-5 h-5 text-[#ACF4A4] shrink-0" />
          <span>{showSuccessToast}</span>
        </div>
      )}

      {/* Top App Header */}
      <header
        id="main-header"
        className="bg-white border-b border-[#E1E3E4] shadow-sm w-full sticky top-0 z-40"
      >
        <div className="flex justify-between items-center w-full px-4 md:px-8 h-20 max-w-[1280px] mx-auto">
          {/* Logo and App Title */}
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#185E20] tracking-tight font-display">
              Gramin Udyam Sahayak
            </h1>
            <span className="text-xs font-semibold text-[#4C616C] tracking-wide mt-0.5">
              {language === 'EN'
                ? 'Government Concessional Credit & Advisory Portal'
                : 'ग्रामीण रियायती ऋण एवं परामर्श पोर्टल'}
            </span>
          </div>

          {/* Top Quick Action Buttons */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Language Switcher */}
            <button
              id="lang-toggle-btn"
              onClick={() => setLanguage((prev) => prev === 'EN' ? 'HI' : prev === 'HI' ? 'GU' : 'EN')}
              aria-label="Toggle language"
              className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg text-[#4C616C] hover:bg-[#F2F4F5] transition-colors text-xs font-bold border border-transparent hover:border-[#E1E3E4]"
              title="Change Language (EN → हिंदी → ગુજરાતી)"
            >
              <Globe className="w-5 h-5" />
              <span className="hidden md:inline">{language === 'EN' ? 'English' : language === 'HI' ? 'हिंदी' : 'ગુજરાતી'}</span>
            </button>

            {/* Help / Guidance */}
            <button
              id="help-modal-btn"
              onClick={() => setShowHelpModal(true)}
              aria-label="Help and Portal Guidelines"
              className="flex items-center justify-center p-2 rounded-full text-[#4C616C] hover:bg-[#F2F4F5] transition-colors"
              title="Portal Guidelines"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Profile */}
            <button
              id="profile-btn"
              onClick={() => {
                setShowSuccessToast('Logged in as Rural Entrepreneur (PAR-8921)');
                setTimeout(() => setShowSuccessToast(null), 3000);
              }}
              aria-label="User Profile"
              className="flex items-center justify-center p-2 rounded-full text-[#4C616C] hover:bg-[#F2F4F5] transition-colors"
              title="User Account"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 pb-28 md:pb-24">
        {/* Module 0: Top Input Section */}
        <section
          id="inputs-panel"
          className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#ECEEEF] p-5 md:p-6 flex flex-col md:flex-row gap-4 md:gap-5 items-stretch md:items-end"
        >
          {/* Location Field */}
          <div className="flex-1 w-full flex flex-col gap-1.5">
            <label
              htmlFor="location-input"
              className="text-xs font-bold text-[#41493E] uppercase tracking-wider"
            >
              {language === 'EN' ? 'Location' : 'स्थान (गाँव / ब्लॉक)'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#4C616C]">
                <MapPin className="w-4 h-4 text-[#185E20]" />
              </span>
              <input
                id="location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter Village / Block / District"
                className="w-full bg-white border border-[#C0C9BB] rounded-lg py-2.5 pl-9 pr-3 text-sm font-medium text-[#191C1D] focus:border-[2px] focus:border-[#185E20] focus:ring-0 focus:outline-none transition-all placeholder:text-[#9EA8A0]"
              />
            </div>
          </div>

          {/* Margin Money (10%) Field */}
          <div className="flex-1 w-full flex flex-col gap-1.5">
            <label
              htmlFor="margin-money-input"
              className="text-xs font-bold text-[#41493E] uppercase tracking-wider"
            >
              {language === 'EN' ? 'Margin Money (10%)' : 'मार्जिन मनी (10%)'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#4C616C] font-bold text-sm">
                ₹
              </span>
              <input
                id="margin-money-input"
                type="number"
                min="0"
                step="1000"
                value={marginMoney}
                onChange={(e) => {
                  const val = e.target.value;
                  setMarginMoney(val === '' ? '' : Number(val));
                }}
                placeholder="0.00"
                className="w-full bg-white border border-[#C0C9BB] rounded-lg py-2.5 pl-8 pr-3 text-sm font-medium text-[#191C1D] focus:border-[2px] focus:border-[#185E20] focus:ring-0 focus:outline-none transition-all placeholder:text-[#9EA8A0]"
              />
            </div>
          </div>

          {/* Business Category Dropdown */}
          <div className="flex-1 w-full flex flex-col gap-1.5">
            <label
              htmlFor="category-select"
              className="text-xs font-bold text-[#41493E] uppercase tracking-wider"
            >
              {language === 'EN' ? 'Business Category' : 'व्यवसाय की श्रेणी'}
            </label>
            <div className="relative">
              <select
                id="category-select"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full bg-white border border-[#C0C9BB] rounded-lg py-2.5 px-3 pr-9 text-sm font-medium text-[#191C1D] focus:border-[2px] focus:border-[#185E20] focus:ring-0 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Dairy & Livestock">Dairy & Livestock</option>
                <option value="Handloom & Textiles">Handloom & Textiles</option>
                <option value="Grocery & Retail">Grocery & Retail</option>
                <option value="Agro-Processing">Agro-Processing</option>
                <option value="Handicrafts">Handicrafts</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#4C616C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons: Voice Autofill Mic + Generate Plan */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            {/* Circular Voice Auto-fill Microphone Button */}
            <button
              id="voice-autofill-btn"
              type="button"
              onClick={toggleRecording}
              disabled={isTranscribing}
              title={
                isRecording
                  ? (language === 'EN' ? 'Stop recording & auto-fill' : 'रिकॉर्डिंग रोकें और स्वतः भरें')
                  : (language === 'EN' ? 'Voice Auto-Fill: Speak your location, margin & business' : 'आवाज़ से भरें: अपना स्थान, राशि और व्यवसाय बोलें')
              }
              aria-label="Voice Auto-Fill"
              className={`relative h-[42px] w-[42px] rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0 shadow-sm cursor-pointer ${
                isRecording
                  ? 'bg-[#BA1A1A] hover:bg-[#93000A] text-white ring-4 ring-[#FFDAD6] animate-pulse'
                  : isTranscribing
                  ? 'bg-[#E1E3E4] text-[#71787D] cursor-wait'
                  : 'bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#185E20] border border-[#A5D6A7] hover:border-[#81C784]'
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#185E20]" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5" />
              )}

              {/* Live Recording Ping Ring Indicator */}
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                </span>
              )}
            </button>

            {/* Generate Button */}
            <button
              id="generate-plan-btn"
              type="button"
              onClick={handleGeneratePlan}
              disabled={isLoading}
              className="bg-[#185E20] hover:bg-[#134D1A] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg py-2.5 px-5 transition-all active:scale-[0.98] flex-1 md:flex-initial shadow-sm whitespace-nowrap h-[42px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#ACF4A4]" />
              )}
              <span>{isLoading ? 'Generating Plan...' : 'Generate Feasibility & Financial Plan'}</span>
            </button>
          </div>
        </section>

        {/* Scheme Exceeded Warning */}
        {schemeExceeded && (
          <div className="bg-[#FFEBED] border border-[#FFCDD2] rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#BA1A1A] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#BA1A1A]">
                {language === 'HI' ? 'परियोजना सीमा पार' : language === 'GU' ? 'પ્રોજેક્ટ મર્યાદા ઓળંગી' : 'Project Exceeds SCA Concessional Limits'}
              </p>
              <p className="text-xs text-[#93000A] mt-1">
                {language === 'HI'
                  ? 'कुल परियोजना लागत ₹50,00,000 से अधिक है। यह SCA रियायती ऋण सीमा से अधिक है। कृपया CGTMSE / Stand-Up India जैसी वाणिज्यिक MSME योजनाएं देखें।'
                  : language === 'GU'
                  ? 'કુલ પ્રોજેક્ટ ખર્ચ ₹50,00,000 થી વધુ છે. SCA રાહત ધિરાણ મર્યાદા ઓળંગી છે. કૃપા કરીને CGTMSE / Stand-Up India જેવી MSME યોજનાઓ જુઓ.'
                  : 'Total project cost exceeds ₹50,00,000. This venture is beyond SCA concessional micro-credit limits. Consider commercial MSME schemes like CGTMSE / Stand-Up India.'}
              </p>
            </div>
          </div>
        )}

        {/* Main 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Module 1 - Financial Calculator & Schemes   */}
          {/* ========================================================= */}
          <div className="md:col-span-5 flex flex-col gap-5">
            {/* Stat Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Badge 1: Your Contribution (10%) */}
              <div
                id="contribution-badge"
                className="bg-[#FFB900] rounded-xl p-4 flex flex-col justify-between border border-[#EAA700] shadow-[0_4px_16px_rgba(255,185,0,0.20)] transition-transform hover:-translate-y-0.5"
              >
                <span className="text-xs font-bold text-[#4C3700] tracking-wide">
                  Your Contribution (10%)
                </span>
                <span className="text-2xl md:text-[28px] font-extrabold text-[#261A00] mt-2 font-display">
                  ₹{formatINR(parsedMargin)}
                </span>
              </div>

              {/* Badge 2: Max Loan Eligibility (90%) */}
              <div
                id="loan-eligibility-badge"
                className="bg-[#ACF4A4] rounded-xl p-4 flex flex-col justify-between border border-[#91D78A] shadow-[0_4px_16px_rgba(172,244,164,0.30)] transition-transform hover:-translate-y-0.5"
              >
                <span className="text-xs font-bold text-[#0C5216] tracking-wide">
                  Max Loan Eligibility (90%)
                </span>
                <span className="text-2xl md:text-[28px] font-extrabold text-[#002203] mt-2 font-display">
                  ₹{formatINR(advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility)}
                </span>
              </div>

              {/* Total Project Size Card (Full Width under Badges) */}
              <div
                id="total-project-size-card"
                className="sm:col-span-2 bg-white rounded-xl p-4 border border-[#C0C9BB] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between"
              >
                <span className="text-sm font-bold text-[#41493E]">Total Project Size</span>
                <span className="text-2xl md:text-[26px] font-extrabold text-[#185E20] font-display">
                  ₹{formatINR(advisoryData?.financialSummary?.totalProjectSize || totalProjectSize)}
                </span>
              </div>
            </div>

            {/* Active Scheme Routing Card */}
            <div
              id="active-scheme-card"
              className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#ECEEEF] flex flex-col overflow-hidden transition-all"
            >
              {/* Header with verified badge and dynamic limit tag */}
              <div className="px-4 py-3 border-b border-[#E6E8E9] bg-[#F8FAFB] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-[#185E20] fill-[#185E20] text-white shrink-0" />
                  <h3 className="text-sm font-bold text-[#185E20] truncate">
                    {advisoryData?.financialSummary?.activeScheme
                      ? `Active Scheme : ${advisoryData.financialSummary.activeScheme}`
                      : activeSchemeName}
                  </h3>
                </div>
                <span className="shrink-0 text-xs font-bold text-[#4C616C] bg-[#ECEEEF] px-2.5 py-0.5 rounded-full">
                  {schemeCapTag}
                </span>
              </div>

              {/* Card Body: Repayment Summary & Allocation */}
              <div className="p-5 flex flex-col gap-4">
                <h4 className="text-sm font-bold text-[#191C1D]">Repayment Summary</h4>

                {/* Table Summary */}
                <div className="flex flex-col border border-[#C0C9BB] rounded-lg overflow-hidden text-sm">
                  {/* Row 1: Grace Period */}
                  <div className="grid grid-cols-2 bg-[#F2F4F5] px-4 py-2.5 border-b border-[#C0C9BB]">
                    <span className="text-xs font-semibold text-[#41493E]">Grace Period</span>
                    <span className="text-sm font-medium text-[#191C1D] text-right font-display">
                      {advisoryData?.financialSummary?.gracePeriodMonths
                        ? `${advisoryData.financialSummary.gracePeriodMonths} Months`
                        : gracePeriod}
                    </span>
                  </div>

                  {/* Row 2: Est. EMI */}
                  <div className="grid grid-cols-2 bg-white px-4 py-2.5 border-b border-[#C0C9BB]">
                    <span className="text-xs font-semibold text-[#41493E]">Est. EMI</span>
                    <span className="text-sm font-extrabold text-[#191C1D] text-right font-display">
                      ₹ {formatINR(advisoryData?.financialSummary?.estimatedEMI || calculatedEMI)} / mo
                    </span>
                  </div>

                  {/* Row 3: Tenure */}
                  <div className="grid grid-cols-2 bg-[#F2F4F5] px-4 py-2.5">
                    <span className="text-xs font-semibold text-[#41493E]">Tenure</span>
                    <span className="text-sm font-medium text-[#191C1D] text-right font-display">
                      {advisoryData?.financialSummary?.tenureMonths || tenureMonths} Months
                    </span>
                  </div>
                </div>

                {/* Allocation Split Progress Bar */}
                <div className="mt-1">
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-[#4C616C]">Allocation Split</span>
                  </div>
                  <div className="h-2.5 w-full flex rounded-full overflow-hidden bg-[#ECEEEF]">
                    <div
                      className="bg-[#91D78A] h-full transition-all duration-500"
                      style={{ width: '70%' }}
                      title="Capital Expenditure (70%)"
                    />
                    <div
                      className="bg-[#FFB900] h-full transition-all duration-500"
                      style={{ width: '30%' }}
                      title="Working Capital (30%)"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold mt-1.5">
                    <span className="text-[#0C5216]">CapEx 70%</span>
                    <span className="text-[#5C4300]">OpEx 30%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Repayment Schedule Component */}
            <RepaymentSchedule
              schedule={advisoryData?.repaymentSchedule || []}
              totalLoan={advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility}
              interestRate={advisoryData?.financialSummary?.interestRate || (isMicroFinance ? 6.5 : 8.0)}
              tenureMonths={advisoryData?.financialSummary?.tenureMonths || tenureMonths}
              gracePeriodMonths={advisoryData?.financialSummary?.gracePeriodMonths || gracePeriodMonths}
              capexAmount={Math.round((advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility) * 0.7)}
              opexAmount={Math.round((advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility) * 0.3)}
              language={language}
            />
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Module 2 - Feasibility & Advisory Report   */}
          {/* ========================================================= */}
          <div className="md:col-span-7">
            <div
              id="feasibility-advisory-card"
              className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#ECEEEF] h-full flex flex-col"
            >
              {/* Header */}
              <div className="p-4 px-5 border-b border-[#E6E8E9] bg-[#F8FAFB] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-bold text-[#191C1D] font-display">
                    {language === 'HI' ? 'स्थानीय व्यवहार्यता एवं परामर्श रिपोर्ट' : language === 'GU' ? 'સ્થાનિક વ્યવહારિકતા અને સલાહ અહેવાલ' : 'Hyper-Local Feasibility & Advisory Report'}
                  </h3>
                  {advisoryData ? (
                    <span className="text-[10px] font-bold text-white bg-[#185E20] px-2 py-0.5 rounded-full">AI LIVE</span>
                  ) : (
                    <span className="text-[10px] font-bold text-[#4C616C] bg-[#ECEEEF] px-2 py-0.5 rounded-full">BASE TEMPLATE</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* TTS Listen Button */}
                  <button
                    id="tts-listen-btn"
                    onClick={toggleSpeech}
                    title={isSpeaking ? 'Stop reading' : 'Listen to Report'}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSpeaking
                        ? 'bg-[#BA1A1A] text-white hover:bg-[#93000A]'
                        : 'bg-[#E8F5E9] text-[#185E20] border border-[#A5D6A7] hover:bg-[#C8E6C9]'
                    }`}
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isSpeaking ? 'Stop' : '🔊 Listen'}</span>
                  </button>
                  <BarChart3 className="w-5 h-5 text-[#4C616C]" />
                </div>
              </div>

              {/* Conditional Loading State or Report Grid */}
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-center gap-3 flex-grow min-h-[320px]">
                  <Loader2 className="w-8 h-8 text-[#185E20] animate-spin" />
                  <span className="text-sm font-bold text-[#191C1D]">Generating Feasibility & Financial Plan...</span>
                  <span className="text-xs text-[#4C616C]">Retrieving local DPR guidelines via pgvector & analyzing feasibility</span>
                </div>
              ) : (
                /* Report Inner Grid */
                <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
                {/* Panel 1: Estimated Local Customers */}
                <div
                  id="local-customers-panel"
                  className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col justify-center items-center text-center gap-1.5 hover:border-[#91D78A] transition-colors"
                >
                  <Users className="w-8 h-8 text-[#185E20]" />
                  <span className="text-2xl md:text-3xl font-extrabold text-[#191C1D] font-display">
                    {activeAdvisory.customers}
                  </span>
                  <span className="text-xs font-semibold text-[#4C616C]">
                    Est. Local Customers ({activeAdvisory.customerRadius})
                  </span>
                </div>

                {/* Panel 2: Opportunities */}
                <div
                  id="opportunities-panel"
                  className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col gap-2 hover:border-[#91D78A] transition-colors"
                >
                  <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-[#694D00]" />
                    <span>Opportunities</span>
                  </h4>
                  <ul className="list-disc pl-4 text-xs font-medium text-[#41493E] space-y-1.5 leading-relaxed">
                    {activeAdvisory.opportunities.map((opp, idx) => (
                      <li key={idx}>{opp}</li>
                    ))}
                  </ul>
                </div>

                {/* Panel 3: SWOT Quadrant Analysis (Full Width inside 2-Col Grid) */}
                <div
                  id="swot-analysis-panel"
                  className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col gap-2 sm:col-span-2"
                >
                  <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider">
                    SWOT Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#C0C9BB] p-1 rounded-lg overflow-hidden">
                    {/* Strengths (S) */}
                    <div className="bg-[#D0E5CE] p-3 text-center rounded flex flex-col items-center justify-center min-h-[64px]">
                      <div className="text-sm font-extrabold text-[#185E20] font-display">S</div>
                      <div className="text-xs font-bold text-[#191C1D] mt-0.5">
                        {activeAdvisory.swot.s}
                      </div>
                    </div>

                    {/* Weaknesses (W) */}
                    <div className="bg-[#E6DEC0] p-3 text-center rounded flex flex-col items-center justify-center min-h-[64px]">
                      <div className="text-sm font-extrabold text-[#4C3700] font-display">W</div>
                      <div className="text-xs font-bold text-[#191C1D] mt-0.5">
                        {activeAdvisory.swot.w}
                      </div>
                    </div>

                    {/* Opportunities (O) */}
                    <div className="bg-[#D3DFE6] p-3 text-center rounded flex flex-col items-center justify-center min-h-[64px]">
                      <div className="text-sm font-extrabold text-[#071E27] font-display">O</div>
                      <div className="text-xs font-bold text-[#191C1D] mt-0.5">
                        {activeAdvisory.swot.o}
                      </div>
                    </div>

                    {/* Threats (T) */}
                    <div className="bg-[#EED6D4] p-3 text-center rounded flex flex-col items-center justify-center min-h-[64px]">
                      <div className="text-sm font-extrabold text-[#BA1A1A] font-display">T</div>
                      <div className="text-xs font-bold text-[#191C1D] mt-0.5">
                        {activeAdvisory.swot.t}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 4: Local Risks */}
                <div
                  id="local-risks-panel"
                  className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col gap-2 justify-between hover:border-[#91D78A] transition-colors"
                >
                  <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#BA1A1A]" />
                    <span>Local Risks</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {activeAdvisory.risks.map((risk, idx) => (
                      <span
                        key={idx}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                          risk.severe
                            ? 'bg-[#FFDAD6] text-[#93000A] border border-[#FFB4AB]'
                            : 'bg-[#E1E3E4] text-[#41493E] border border-[#C0C9BB]'
                        }`}
                      >
                        {risk.text}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Panel 5: Competitor Density & Suggested Pricing Benchmark */}
                <div
                  id="gauges-panel"
                  className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col justify-between gap-3 hover:border-[#91D78A] transition-colors"
                >
                  {/* Competitor Density */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className="text-xs font-bold text-[#191C1D]">Competitor Density</h4>
                      <span className="text-[11px] font-bold text-[#694D00] bg-[#FFDFA0] px-2 py-0.5 rounded">
                        {activeAdvisory.competitorDensity}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#E1E3E4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FFB900] rounded-full transition-all duration-500"
                        style={{ width: `${activeAdvisory.densityPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Suggested Pricing Benchmark */}
                  <div className="pt-2.5 border-t border-[#E1E3E4]">
                    <h4 className="text-xs font-bold text-[#191C1D] mb-1">
                      Suggested Pricing Benchmark
                    </h4>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xl font-extrabold text-[#185E20] font-display">
                        {activeAdvisory.benchmarkPrice}
                      </span>
                      <span className="text-xs font-semibold text-[#4C616C]">
                        {activeAdvisory.benchmarkUnit} (Local Avg: {activeAdvisory.localAvg})
                      </span>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </div>

            {/* Viability Dashboard Component */}
            <ViabilityDashboard
              metrics={advisoryData?.viabilityMetrics || null}
              emi={advisoryData?.financialSummary?.estimatedEMI || calculatedEMI}
              businessCategory={businessCategory}
              language={language}
            />
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* FOOTER BAR: Concessional Credit Portal & Primary CTA      */}
      {/* ========================================================= */}
      <footer
        id="app-footer"
        className="bg-white border-t border-[#E1E3E4] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] fixed bottom-0 w-full z-40"
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-8 py-3.5 w-full max-w-[1280px] mx-auto gap-3">
          {/* Copyright text */}
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-[#185E20] text-center md:text-left">
            © 2024 GRAMIN UDYAM SAHAYAK. GOVERNMENT CONCESSIONAL CREDIT & ADVISORY PORTAL.
          </span>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Download Official DPR */}
            <button
              id="download-dpr-btn"
              onClick={handleDownloadDPR}
              className="flex-1 md:flex-none text-[#4C616C] border border-[#4C616C] px-5 py-2 rounded-xl font-bold text-xs md:text-sm hover:bg-[#F2F4F5] transition-all active:translate-y-0.5 text-center flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>{language === 'HI' ? 'DPR डाउनलोड' : language === 'GU' ? 'DPR ડાઉનલોડ' : 'Download Official DPR'}</span>
            </button>

            {/* Proceed to Loan Application */}
            <button
              id="proceed-loan-btn"
              onClick={() => setShowLoanModal(true)}
              className="flex-1 md:flex-none bg-[#185E20] text-white font-bold px-6 py-2 rounded-xl text-xs md:text-sm hover:bg-[#134D1A] transition-all active:translate-y-0.5 text-center whitespace-nowrap shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Proceed to Loan Application</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* MODAL: Loan Application Flow                             */}
      {/* ========================================================= */}
      {showLoanModal && (
        <div
          id="loan-application-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#C0C9BB] flex flex-col gap-4 relative animate-in fade-in zoom-in duration-200">
            <button
              id="close-loan-modal"
              onClick={() => setShowLoanModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#4C616C] hover:bg-[#F2F4F5]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[#E1E3E4] pb-3">
              <FileCheck2 className="w-6 h-6 text-[#185E20]" />
              <div>
                <h3 className="text-lg font-bold text-[#191C1D] font-display">
                  Apply for {isMicroFinance ? 'Micro Finance' : 'Term Loan'}
                </h3>
                <p className="text-xs text-[#4C616C]">
                  Concessional Rural Entrepreneurship Credit Scheme
                </p>
              </div>
            </div>

            {/* Application Summary Box */}
            <div className="bg-[#F2F4F5] rounded-xl p-3.5 text-xs space-y-1.5 border border-[#C0C9BB]">
              <div className="flex justify-between">
                <span className="text-[#41493E]">Project Category:</span>
                <span className="font-bold text-[#191C1D]">{businessCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#41493E]">Location:</span>
                <span className="font-bold text-[#191C1D]">{location || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#41493E]">Requested Loan (90%):</span>
                <span className="font-bold text-[#185E20] text-sm">
                  ₹{formatINR(maxLoanEligibility)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#41493E]">Margin Contribution (10%):</span>
                <span className="font-bold text-[#4C3700]">₹{formatINR(parsedMargin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#41493E]">Estimated Monthly EMI:</span>
                <span className="font-bold text-[#191C1D]">₹{formatINR(calculatedEMI)} / mo</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLoanSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-bold text-[#41493E]">Applicant Full Name</label>
                <input
                  required
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra Patel"
                  className="w-full mt-1 bg-white border border-[#C0C9BB] rounded-lg py-2 px-3 text-sm focus:border-[#185E20] focus:ring-0 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#41493E]">Aadhaar-Linked Mobile Number</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-[#4C616C]">
                    +91
                  </span>
                  <input
                    required
                    type="tel"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-white border border-[#C0C9BB] rounded-lg py-2 pl-12 pr-3 text-sm focus:border-[#185E20] focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              <div className="text-[11px] text-[#4C616C] bg-[#ACF4A4]/25 p-2.5 rounded-lg border border-[#91D78A]/50 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-[#185E20] shrink-0 mt-0.5" />
                <span>
                  No collateral required up to ₹1.40 Lakh under the Credit Guarantee Fund Trust for
                  Micro and Small Enterprises (CGTMSE).
                </span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 border border-[#4C616C] py-2 rounded-xl text-xs font-bold text-[#4C616C] hover:bg-[#F2F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#185E20] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#134D1A] flex items-center justify-center gap-1"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Help & Guidelines                                  */}
      {/* ========================================================= */}
      {showHelpModal && (
        <div
          id="help-guidelines-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#C0C9BB] flex flex-col gap-4 relative animate-in fade-in zoom-in duration-200">
            <button
              id="close-help-modal"
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#4C616C] hover:bg-[#F2F4F5]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[#E1E3E4] pb-3">
              <HelpCircle className="w-6 h-6 text-[#185E20]" />
              <h3 className="text-lg font-bold text-[#191C1D] font-display">
                Gramin Udyam Sahayak Guidelines
              </h3>
            </div>

            <div className="text-xs text-[#41493E] space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <h4 className="font-bold text-[#191C1D] text-sm mb-1">1. How Margin Money Works</h4>
                <p>
                  Entrepreneurs contribute 10% of the total project size as margin equity. The
                  Government concessional credit scheme sponsors the remaining 90% via participating
                  Regional Rural Banks (RRBs) and public sector lenders.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#191C1D] text-sm mb-1">2. Scheme Routing Thresholds</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Micro Finance Scheme (≤ ₹1.40 Lakh):</strong> Simplified KYC, 6-month
                    grace period, subsidized 6.0% interest rate, and zero processing fees.
                  </li>
                  <li>
                    <strong>Term Loan Scheme (&gt; ₹1.40 Lakh):</strong> 12-month grace period for
                    machinery installations, tenure up to 84 months, subsidized 7.5% interest rate.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-[#191C1D] text-sm mb-1">3. Feasibility & Advisory Metrics</h4>
                <p>
                  Estimates are curated using hyper-local census data, Krishi Vigyan Kendra (KVK)
                  surveys, and APMC market price indices for rural micro-enterprises.
                </p>
              </div>

              <div className="bg-[#F2F4F5] p-3 rounded-lg flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#185E20] shrink-0" />
                <span>
                  National Rural Credit Toll-Free Helpline: <strong>1800-180-1111</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="bg-[#185E20] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#134D1A] transition-colors"
            >
              Close Guidelines
            </button>
          </div>
        </div>
      )}

      {/* Hidden DPR Export Component (only visible during print) */}
      <DPRExport
        applicantName={applicantName}
        contactNumber={contactNumber}
        location={location}
        businessCategory={businessCategory}
        language={language}
        financialSummary={{
          userContribution: advisoryData?.financialSummary?.userContribution || parsedMargin,
          maxLoanEligibility: advisoryData?.financialSummary?.maxLoanEligibility || maxLoanEligibility,
          totalProjectSize: advisoryData?.financialSummary?.totalProjectSize || totalProjectSize,
          activeScheme: advisoryData?.financialSummary?.activeScheme || (isMicroFinance ? 'Micro Finance Scheme' : 'Term Loan Scheme'),
          interestRate: advisoryData?.financialSummary?.interestRate || (isMicroFinance ? 6.5 : 8.0),
          tenureMonths: advisoryData?.financialSummary?.tenureMonths || tenureMonths,
          gracePeriodMonths: advisoryData?.financialSummary?.gracePeriodMonths || gracePeriodMonths,
          estimatedEMI: advisoryData?.financialSummary?.estimatedEMI || calculatedEMI,
        }}
        feasibilityReport={advisoryData?.feasibilityReport || {}}
        repaymentSchedule={advisoryData?.repaymentSchedule || []}
        viabilityMetrics={advisoryData?.viabilityMetrics || null}
      />
    </div>
  );
}
