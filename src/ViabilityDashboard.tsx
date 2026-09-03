import React from 'react';
import { TrendingUp, AlertTriangle, DollarSign, Target, Activity } from 'lucide-react';

export interface ViabilityMetrics {
  estimatedMonthlyRevenue: number;
  estimatedMonthlyExpenses: number;
  netMonthlySurplus: number;
  dscr: number;
  breakEvenMonths: number;
  viabilityRating: 'STRONG' | 'MODERATE' | 'WEAK';
}

interface ViabilityDashboardProps {
  metrics: ViabilityMetrics | null;
  emi: number;
  businessCategory: string;
  language: 'EN' | 'HI' | 'GU';
}

const LABELS: Record<string, Record<string, string>> = {
  title: {
    EN: 'Enterprise Viability & Break-Even Analysis',
    HI: 'उद्यम व्यवहार्यता एवं ब्रेक-ईवन विश्लेषण',
    GU: 'ઉદ્યમ વ્યવહારિકતા અને બ્રેક-ઇવન વિશ્લેષણ',
  },
  monthlyRevenue: { EN: 'Est. Monthly Revenue', HI: 'अनुमानित मासिक आय', GU: 'અંદાજિત માસિક આવક' },
  monthlyExpenses: { EN: 'Operating Expenses', HI: 'परिचालन व्यय', GU: 'સંચાલન ખર્ચ' },
  netSurplus: { EN: 'Net Monthly Surplus', HI: 'शुद्ध मासिक अधिशेष', GU: 'ચોખ્ખું માસિક સરપ્લસ' },
  emi: { EN: 'Monthly EMI', HI: 'मासिक EMI', GU: 'માસિક EMI' },
  dscr: { EN: 'Debt Service Coverage Ratio', HI: 'ऋण सेवा कवरेज अनुपात', GU: 'ઋણ સેવા કવરેજ ગુણોત્તર' },
  breakEven: { EN: 'Break-Even Timeline', HI: 'ब्रेक-ईवन समयसीमा', GU: 'બ્રેક-ઇવન સમયરેખા' },
  months: { EN: 'months', HI: 'महीने', GU: 'મહિના' },
  strong: { EN: 'STRONG — Enterprise can comfortably service the loan', HI: 'मजबूत — उद्यम आसानी से ऋण चुका सकता है', GU: 'મજબૂત — ઉદ્યમ આરામથી લોન ચૂકવી શકે છે' },
  moderate: { EN: 'MODERATE — Viable but margins are tight', HI: 'सामान्य — व्यवहार्य लेकिन मार्जिन तंग', GU: 'મધ્યમ — વ્યવહારુ પરંતુ માર્જિન ચુસ્ત' },
  weak: { EN: 'WEAK — Revenue may not cover EMI obligations', HI: 'कमजोर — आय EMI दायित्वों को कवर नहीं कर सकती', GU: 'નબળું — આવક EMI જવાબદારીઓ આવરી શકે નહીં' },
  unitEconomics: { EN: 'Unit Economics', HI: 'इकाई अर्थशास्त्र', GU: 'એકમ અર્થશાસ્ત્ર' },
};

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);

export default function ViabilityDashboard({
  metrics,
  emi,
  businessCategory,
  language,
}: ViabilityDashboardProps) {
  const lang = language || 'EN';
  const t = (key: string) => LABELS[key]?.[lang] || LABELS[key]?.EN || key;

  // Fallback metrics if not provided by backend
  const m: ViabilityMetrics = metrics || {
    estimatedMonthlyRevenue: 33000,
    estimatedMonthlyExpenses: 18000,
    netMonthlySurplus: 15000,
    dscr: emi > 0 ? 15000 / emi : 0,
    breakEvenMonths: 8,
    viabilityRating: 'MODERATE',
  };

  const dscrColor =
    m.viabilityRating === 'STRONG'
      ? '#185E20'
      : m.viabilityRating === 'MODERATE'
      ? '#B8860B'
      : '#BA1A1A';

  const dscrBgColor =
    m.viabilityRating === 'STRONG'
      ? '#E8F5E9'
      : m.viabilityRating === 'MODERATE'
      ? '#FFF8E1'
      : '#FFEBED';

  const dscrBorderColor =
    m.viabilityRating === 'STRONG'
      ? '#A5D6A7'
      : m.viabilityRating === 'MODERATE'
      ? '#FFE082'
      : '#FFCDD2';

  const ratingLabel =
    m.viabilityRating === 'STRONG'
      ? t('strong')
      : m.viabilityRating === 'MODERATE'
      ? t('moderate')
      : t('weak');

  // SVG arc for DSCR gauge
  const dscrClamped = Math.min(Math.max(m.dscr, 0), 3);
  const arcPercentage = (dscrClamped / 3) * 100;
  const arcRadius = 60;
  const arcCircumference = Math.PI * arcRadius; // semicircle
  const arcOffset = arcCircumference - (arcPercentage / 100) * arcCircumference;

  // Break-even bar (capped at 36 months for display)
  const breakEvenClamped = Math.min(m.breakEvenMonths, 36);
  const breakEvenPercent = (breakEvenClamped / 36) * 100;

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#ECEEEF] flex flex-col overflow-hidden print-break-inside-avoid">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E6E8E9] bg-[#F8FAFB] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#185E20]" />
          <h3 className="text-sm font-bold text-[#185E20]">{t('title')}</h3>
        </div>
        <span
          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: dscrBgColor, color: dscrColor, border: `1px solid ${dscrBorderColor}` }}
        >
          {m.viabilityRating}
        </span>
      </div>

      <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Unit Economics Card */}
        <div className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col gap-3 sm:col-span-2">
          <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-[#185E20]" />
            {t('unitEconomics')} — {businessCategory}
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Revenue */}
            <div className="bg-white rounded-lg p-3 border border-[#C8E6C9]">
              <span className="text-[10px] font-bold text-[#0C5216] uppercase">{t('monthlyRevenue')}</span>
              <p className="text-lg font-extrabold text-[#185E20] font-display mt-1">
                ₹{formatINR(m.estimatedMonthlyRevenue)}
              </p>
            </div>

            {/* Expenses */}
            <div className="bg-white rounded-lg p-3 border border-[#FFE082]">
              <span className="text-[10px] font-bold text-[#5C4300] uppercase">{t('monthlyExpenses')}</span>
              <p className="text-lg font-extrabold text-[#694D00] font-display mt-1">
                ₹{formatINR(m.estimatedMonthlyExpenses)}
              </p>
            </div>

            {/* Net Surplus */}
            <div className="bg-white rounded-lg p-3 border border-[#A5D6A7]">
              <span className="text-[10px] font-bold text-[#0C5216] uppercase">{t('netSurplus')}</span>
              <p className={`text-lg font-extrabold font-display mt-1 ${m.netMonthlySurplus >= 0 ? 'text-[#185E20]' : 'text-[#BA1A1A]'}`}>
                ₹{formatINR(m.netMonthlySurplus)}
              </p>
            </div>

            {/* EMI */}
            <div className="bg-white rounded-lg p-3 border border-[#ECEEEF]">
              <span className="text-[10px] font-bold text-[#4C616C] uppercase">{t('emi')}</span>
              <p className="text-lg font-extrabold text-[#191C1D] font-display mt-1">
                ₹{formatINR(emi)}
              </p>
            </div>
          </div>
        </div>

        {/* DSCR Gauge */}
        <div className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col items-center gap-2">
          <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider text-center">
            {t('dscr')}
          </h4>

          {/* SVG Gauge */}
          <svg viewBox="0 0 140 80" className="w-32 h-auto">
            {/* Background arc */}
            <path
              d="M 10 75 A 60 60 0 0 1 130 75"
              fill="none"
              stroke="#ECEEEF"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d="M 10 75 A 60 60 0 0 1 130 75"
              fill="none"
              stroke={dscrColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${arcCircumference}`}
              strokeDashoffset={`${arcOffset}`}
              className="transition-all duration-700"
            />
            {/* Value text */}
            <text x="70" y="65" textAnchor="middle" className="fill-[#191C1D]" fontSize="20" fontWeight="800">
              {m.dscr.toFixed(2)}
            </text>
            <text x="70" y="78" textAnchor="middle" className="fill-[#4C616C]" fontSize="8" fontWeight="600">
              DSCR
            </text>
          </svg>

          <p className="text-[10px] font-bold text-center px-2 leading-tight" style={{ color: dscrColor }}>
            {ratingLabel}
          </p>
        </div>

        {/* Break-Even Timeline */}
        <div className="bg-[#F8FAFB] rounded-xl p-4 border border-[#C0C9BB] flex flex-col justify-between gap-3">
          <h4 className="text-xs font-bold text-[#191C1D] uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#185E20]" />
            {t('breakEven')}
          </h4>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-3 w-full bg-[#ECEEEF] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${breakEvenPercent}%`,
                    background: `linear-gradient(90deg, ${dscrColor} 0%, ${dscrBorderColor} 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#4C616C] font-medium">0</span>
                <span className="text-[10px] text-[#4C616C] font-medium">36 {t('months')}</span>
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0 bg-white rounded-lg p-2 border border-[#C0C9BB] min-w-[60px]">
              <span className="text-xl font-extrabold font-display" style={{ color: dscrColor }}>
                {m.breakEvenMonths}
              </span>
              <span className="text-[9px] font-bold text-[#4C616C] uppercase">{t('months')}</span>
            </div>
          </div>

          {/* Surplus vs EMI Visual */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-[#ECEEEF]">
            <TrendingUp className="w-4 h-4 text-[#185E20] shrink-0" />
            <span className="text-[10px] font-medium text-[#41493E] leading-tight">
              {m.netMonthlySurplus > emi
                ? (lang === 'HI'
                    ? `अधिशेष ₹${formatINR(m.netMonthlySurplus)} > EMI ₹${formatINR(emi)} — ऋण सुरक्षित`
                    : lang === 'GU'
                    ? `સરપ્લસ ₹${formatINR(m.netMonthlySurplus)} > EMI ₹${formatINR(emi)} — લોન સુરક્ષિત`
                    : `Surplus ₹${formatINR(m.netMonthlySurplus)} > EMI ₹${formatINR(emi)} — Loan is serviceable`)
                : (lang === 'HI'
                    ? `अधिशेष ₹${formatINR(m.netMonthlySurplus)} ≤ EMI ₹${formatINR(emi)} — अतिरिक्त आय आवश्यक`
                    : lang === 'GU'
                    ? `સરપ્લસ ₹${formatINR(m.netMonthlySurplus)} ≤ EMI ₹${formatINR(emi)} — વધારાની આવક જરૂરી`
                    : `Surplus ₹${formatINR(m.netMonthlySurplus)} ≤ EMI ₹${formatINR(emi)} — Additional revenue needed`)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
