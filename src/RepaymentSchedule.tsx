import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Info } from 'lucide-react';

export interface RepaymentEntry {
  quarter: number;
  type: 'MORATORIUM' | 'REPAYMENT';
  principalPaid: number;
  interestPaid: number;
  balance: number;
}

interface RepaymentScheduleProps {
  schedule: RepaymentEntry[];
  totalLoan: number;
  interestRate: number;
  tenureMonths: number;
  gracePeriodMonths: number;
  capexAmount: number;
  opexAmount: number;
  language: 'EN' | 'HI' | 'GU';
}

const LABELS: Record<string, Record<string, string>> = {
  title: {
    EN: 'Quarterly Repayment & Moratorium Schedule',
    HI: 'त्रैमासिक पुनर्भुगतान एवं ऋण स्थगन अनुसूची',
    GU: 'ત્રિમાસિક ચુકવણી અને મોરેટોરિયમ શેડ્યૂલ',
  },
  quarter: { EN: 'Qtr', HI: 'तिमाही', GU: 'ત્રિમાસ' },
  type: { EN: 'Type', HI: 'प्रकार', GU: 'પ્રકાર' },
  principal: { EN: 'Principal', HI: 'मूलधन', GU: 'મૂળધન' },
  interest: { EN: 'Interest', HI: 'ब्याज', GU: 'વ્યાજ' },
  balance: { EN: 'Balance', HI: 'शेष राशि', GU: 'બાકી રકમ' },
  moratorium: { EN: 'Interest Only', HI: 'केवल ब्याज', GU: 'ફક્ત વ્યાજ' },
  repayment: { EN: 'P + I', HI: 'मूलधन + ब्याज', GU: 'મૂળધન + વ્યાજ' },
  allocationTitle: { EN: 'Fund Allocation Breakdown', HI: 'निधि आवंटन विवरण', GU: 'ભંડોળ ફાળવણી વિગત' },
  capex: { EN: 'Capital Expenditure (Machinery / Equipment)', HI: 'पूंजीगत व्यय (मशीनरी / उपकरण)', GU: 'મૂડી ખર્ચ (મશીનરી / સાધન)' },
  opex: { EN: 'Working Capital (Raw Material / Operations)', HI: 'कार्यशील पूंजी (कच्चा माल / संचालन)', GU: 'કાર્યકારી મૂડી (કાચો માલ / સંચાલન)' },
  showAll: { EN: 'Show Full Schedule', HI: 'पूरी अनुसूची दिखाएं', GU: 'પૂરું શેડ્યૂલ બતાવો' },
  collapse: { EN: 'Collapse Schedule', HI: 'अनुसूची छुपाएं', GU: 'શેડ્યૂલ છુપાવો' },
  totalInterest: { EN: 'Total Interest Payable', HI: 'कुल देय ब्याज', GU: 'કુલ ચૂકવવાપાત્ર વ્યાજ' },
};

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);

export default function RepaymentSchedule({
  schedule,
  totalLoan,
  interestRate,
  tenureMonths,
  gracePeriodMonths,
  capexAmount,
  opexAmount,
  language,
}: RepaymentScheduleProps) {
  const [expanded, setExpanded] = useState(false);
  const lang = language || 'EN';
  const t = (key: string) => LABELS[key]?.[lang] || LABELS[key]?.EN || key;

  if (!schedule || schedule.length === 0) return null;

  const totalInterestPayable = schedule.reduce((sum, q) => sum + q.interestPaid, 0);
  const displaySchedule = expanded ? schedule : schedule.slice(0, 6);

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#ECEEEF] flex flex-col overflow-hidden print-break-inside-avoid">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E6E8E9] bg-[#F8FAFB] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#185E20]" />
          <h3 className="text-sm font-bold text-[#185E20]">{t('title')}</h3>
        </div>
        <span className="text-[10px] font-bold text-[#4C616C] bg-[#ECEEEF] px-2.5 py-0.5 rounded-full">
          {interestRate}% · {tenureMonths}mo · {gracePeriodMonths}mo grace
        </span>
      </div>

      <div className="p-4 md:p-5 flex flex-col gap-4">
        {/* Fund Allocation Breakdown */}
        <div className="bg-[#F8FAFB] rounded-lg p-3 border border-[#C0C9BB]">
          <h4 className="text-xs font-bold text-[#191C1D] mb-2">{t('allocationTitle')}</h4>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#41493E]">{t('capex')}</span>
              <span className="text-xs font-bold text-[#0C5216]">₹{formatINR(capexAmount)} (70%)</span>
            </div>
            <div className="h-2 w-full flex rounded-full overflow-hidden bg-[#ECEEEF]">
              <div className="bg-[#91D78A] h-full" style={{ width: '70%' }} />
              <div className="bg-[#FFB900] h-full" style={{ width: '30%' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#41493E]">{t('opex')}</span>
              <span className="text-xs font-bold text-[#5C4300]">₹{formatINR(opexAmount)} (30%)</span>
            </div>
          </div>
        </div>

        {/* Quarterly Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2F4F5] border-b border-[#C0C9BB]">
                <th className="text-left px-3 py-2 font-bold text-[#41493E]">{t('quarter')}</th>
                <th className="text-left px-3 py-2 font-bold text-[#41493E]">{t('type')}</th>
                <th className="text-right px-3 py-2 font-bold text-[#41493E]">{t('principal')}</th>
                <th className="text-right px-3 py-2 font-bold text-[#41493E]">{t('interest')}</th>
                <th className="text-right px-3 py-2 font-bold text-[#41493E]">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {displaySchedule.map((entry) => (
                <tr
                  key={entry.quarter}
                  className={`border-b border-[#ECEEEF] transition-colors ${
                    entry.type === 'MORATORIUM'
                      ? 'bg-[#FFF8E1] hover:bg-[#FFF3C4]'
                      : 'bg-white hover:bg-[#F8FAFB]'
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-[#191C1D]">Q{entry.quarter}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        entry.type === 'MORATORIUM'
                          ? 'bg-[#FFE082] text-[#5C4300]'
                          : 'bg-[#C8E6C9] text-[#0C5216]'
                      }`}
                    >
                      {entry.type === 'MORATORIUM' ? t('moratorium') : t('repayment')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[#191C1D]">
                    {entry.principalPaid === 0 ? '—' : `₹${formatINR(entry.principalPaid)}`}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[#694D00]">
                    ₹{formatINR(entry.interestPaid)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-[#191C1D]">₹{formatINR(entry.balance)}</span>
                      <div className="h-1 w-16 bg-[#ECEEEF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#185E20] rounded-full transition-all duration-300"
                          style={{ width: `${totalLoan > 0 ? (entry.balance / totalLoan) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand / Collapse Toggle */}
        {schedule.length > 6 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#185E20] hover:bg-[#E8F5E9] py-2 rounded-lg transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{expanded ? t('collapse') : `${t('showAll')} (${schedule.length} quarters)`}</span>
          </button>
        )}

        {/* Total Interest Summary */}
        <div className="flex items-center justify-between bg-[#F2F4F5] rounded-lg px-4 py-2.5 border border-[#C0C9BB]">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#4C616C]" />
            <span className="text-xs font-semibold text-[#41493E]">{t('totalInterest')}</span>
          </div>
          <span className="text-sm font-extrabold text-[#694D00] font-display">
            ₹{formatINR(totalInterestPayable)}
          </span>
        </div>
      </div>
    </div>
  );
}
