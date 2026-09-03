import React from 'react';

interface DPRExportProps {
  applicantName: string;
  contactNumber: string;
  location: string;
  businessCategory: string;
  language: 'EN' | 'HI' | 'GU';
  financialSummary: {
    userContribution: number;
    maxLoanEligibility: number;
    totalProjectSize: number;
    activeScheme: string;
    interestRate: number;
    tenureMonths: number;
    gracePeriodMonths: number;
    estimatedEMI: number;
  };
  feasibilityReport: {
    marketReach?: { estimatedCustomers: number; catchmentRadiusKm: number; distributionChannels: string[] };
    opportunityAnalysis?: string[];
    swotAnalysis?: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
    localRisks?: { title: string; description: string; severity: string }[];
    competitorMapping?: { densityIndex: string; summary: string };
    pricingStrategy?: { suggestedPriceUnit: string; benchmarkPrice: string };
  };
  repaymentSchedule: { quarter: number; type: string; principalPaid: number; interestPaid: number; balance: number }[];
  viabilityMetrics: {
    estimatedMonthlyRevenue: number;
    estimatedMonthlyExpenses: number;
    netMonthlySurplus: number;
    dscr: number;
    breakEvenMonths: number;
    viabilityRating: string;
  } | null;
}

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);

const today = () => {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function DPRExport({
  applicantName,
  contactNumber,
  location,
  businessCategory,
  language,
  financialSummary: fs,
  feasibilityReport: fr,
  repaymentSchedule,
  viabilityMetrics: vm,
}: DPRExportProps) {
  const totalInterest = (repaymentSchedule || []).reduce((s, q) => s + q.interestPaid, 0);

  return (
    <div id="dpr-export-container" className="dpr-container hidden print:block">
      {/* ═══════════════ PAGE 1: COVER PAGE ═══════════════ */}
      <div className="dpr-page">
        <div className="dpr-cover">
          <div className="dpr-cover-header">
            <p className="dpr-cover-govt">Government of India</p>
            <p className="dpr-cover-ministry">Ministry of Micro, Small & Medium Enterprises</p>
            <hr className="dpr-hr" />
            <h1 className="dpr-cover-title">DETAILED PROJECT REPORT</h1>
            <p className="dpr-cover-subtitle">(Prepared under {fs.activeScheme})</p>
          </div>

          <div className="dpr-cover-body">
            <table className="dpr-cover-table">
              <tbody>
                <tr><td className="dpr-label">Project Title</td><td className="dpr-value">{businessCategory} Enterprise Unit</td></tr>
                <tr><td className="dpr-label">Applicant</td><td className="dpr-value">{applicantName || 'Rural Micro-Entrepreneur'}</td></tr>
                <tr><td className="dpr-label">Location</td><td className="dpr-value">{location}</td></tr>
                <tr><td className="dpr-label">Scheme</td><td className="dpr-value">{fs.activeScheme}</td></tr>
                <tr><td className="dpr-label">Total Project Cost</td><td className="dpr-value">₹{formatINR(fs.totalProjectSize)}</td></tr>
                <tr><td className="dpr-label">Date of Preparation</td><td className="dpr-value">{today()}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="dpr-cover-footer">
            <p>Prepared using <strong>Gramin Udyam Sahayak</strong> AI Advisory Portal</p>
            <p className="dpr-disclaimer">Government Concessional Credit & Advisory Platform for Rural Micro-Enterprises</p>
          </div>
        </div>
      </div>

      {/* ═══════════════ PAGE 2: APPLICANT PROFILE & PROJECT SUMMARY ═══════════════ */}
      <div className="dpr-page">
        <h2 className="dpr-section-title">1. Applicant Profile & Project Summary</h2>

        <h3 className="dpr-subsection">1.1 Applicant Information</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">Full Name</td><td>{applicantName || '—'}</td></tr>
            <tr><td className="dpr-label">Mobile (Aadhaar-Linked)</td><td>+91 {contactNumber || '—'}</td></tr>
            <tr><td className="dpr-label">Location</td><td>{location}</td></tr>
            <tr><td className="dpr-label">Business Category</td><td>{businessCategory}</td></tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">1.2 Financial Summary</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">Total Project Cost (100%)</td><td className="dpr-value-bold">₹{formatINR(fs.totalProjectSize)}</td></tr>
            <tr><td className="dpr-label">Borrower's Equity (10%)</td><td>₹{formatINR(fs.userContribution)}</td></tr>
            <tr><td className="dpr-label">Concessional Loan Amount (90%)</td><td className="dpr-value-bold">₹{formatINR(fs.maxLoanEligibility)}</td></tr>
            <tr><td className="dpr-label">Active Scheme</td><td>{fs.activeScheme}</td></tr>
            <tr><td className="dpr-label">Interest Rate</td><td>{fs.interestRate}% per annum (reducing balance)</td></tr>
            <tr><td className="dpr-label">Tenure</td><td>{fs.tenureMonths} months ({Math.round(fs.tenureMonths / 12)} years)</td></tr>
            <tr><td className="dpr-label">Moratorium Period</td><td>{fs.gracePeriodMonths} months</td></tr>
            <tr><td className="dpr-label">Estimated Monthly EMI</td><td className="dpr-value-bold">₹{formatINR(fs.estimatedEMI)} / month</td></tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">1.3 Fund Allocation</h3>
        <table className="dpr-table">
          <tbody>
            <tr>
              <td className="dpr-label">Capital Expenditure (70%)</td>
              <td>₹{formatINR(Math.round(fs.maxLoanEligibility * 0.7))}</td>
              <td>Machinery, Equipment, Infrastructure</td>
            </tr>
            <tr>
              <td className="dpr-label">Working Capital (30%)</td>
              <td>₹{formatINR(Math.round(fs.maxLoanEligibility * 0.3))}</td>
              <td>Raw Materials, Initial Operations</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════ PAGE 3: FEASIBILITY REPORT ═══════════════ */}
      <div className="dpr-page">
        <h2 className="dpr-section-title">2. Hyper-Local Feasibility Report</h2>

        <h3 className="dpr-subsection">2.1 Market Reach Assessment</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">Estimated Local Customers</td><td>{fr.marketReach?.estimatedCustomers || '1,250'}+</td></tr>
            <tr><td className="dpr-label">Catchment Radius</td><td>{fr.marketReach?.catchmentRadiusKm || 5} km</td></tr>
            <tr>
              <td className="dpr-label">Distribution Channels</td>
              <td>{(fr.marketReach?.distributionChannels || ['Local Direct Sales']).join('; ')}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">2.2 Opportunity Analysis</h3>
        <ol className="dpr-list">
          {(fr.opportunityAnalysis || ['High regional demand']).map((opp, idx) => (
            <li key={idx}>{opp}</li>
          ))}
        </ol>

        <h3 className="dpr-subsection">2.3 SWOT Analysis</h3>
        <table className="dpr-table dpr-swot-table">
          <thead>
            <tr>
              <th>Strengths</th>
              <th>Weaknesses</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <ul>{(fr.swotAnalysis?.strengths || ['Local resources']).map((s, i) => <li key={i}>{s}</li>)}</ul>
              </td>
              <td>
                <ul>{(fr.swotAnalysis?.weaknesses || ['Infrastructure gaps']).map((w, i) => <li key={i}>{w}</li>)}</ul>
              </td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th>Opportunities</th>
              <th>Threats</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <ul>{(fr.swotAnalysis?.opportunities || ['Market growth']).map((o, i) => <li key={i}>{o}</li>)}</ul>
              </td>
              <td>
                <ul>{(fr.swotAnalysis?.threats || ['Competition']).map((t, i) => <li key={i}>{t}</li>)}</ul>
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">2.4 Local Risk Assessment</h3>
        <table className="dpr-table">
          <thead><tr><th>Risk</th><th>Description</th><th>Severity</th></tr></thead>
          <tbody>
            {(fr.localRisks || [{ title: 'Operational Risk', description: 'General', severity: 'MEDIUM' }]).map((r, idx) => (
              <tr key={idx}>
                <td className="dpr-label">{r.title}</td>
                <td>{r.description}</td>
                <td><strong>{r.severity}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="dpr-subsection">2.5 Competitor & Pricing Assessment</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">Competitor Density</td><td>{fr.competitorMapping?.densityIndex || 'LOW'}</td></tr>
            <tr><td className="dpr-label">Assessment</td><td>{fr.competitorMapping?.summary || 'Manageable competition'}</td></tr>
            <tr><td className="dpr-label">Suggested Pricing</td><td>{fr.pricingStrategy?.benchmarkPrice || '—'} {fr.pricingStrategy?.suggestedPriceUnit || ''}</td></tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════ PAGE 4: REPAYMENT SCHEDULE ═══════════════ */}
      <div className="dpr-page">
        <h2 className="dpr-section-title">3. Quarterly Repayment Schedule</h2>

        <p className="dpr-note">
          Moratorium Period: {fs.gracePeriodMonths} months (interest-only). Post-moratorium: Reducing-balance quarterly installments.
          Total Interest Payable: ₹{formatINR(totalInterest)}.
        </p>

        <table className="dpr-table dpr-repayment-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Type</th>
              <th>Principal (₹)</th>
              <th>Interest (₹)</th>
              <th>Outstanding Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(repaymentSchedule || []).map((entry) => (
              <tr key={entry.quarter} className={entry.type === 'MORATORIUM' ? 'dpr-moratorium-row' : ''}>
                <td>Q{entry.quarter}</td>
                <td>{entry.type === 'MORATORIUM' ? 'Moratorium' : 'Repayment'}</td>
                <td>{entry.principalPaid === 0 ? '—' : formatINR(entry.principalPaid)}</td>
                <td>{formatINR(entry.interestPaid)}</td>
                <td>{formatINR(entry.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════ PAGE 5: VIABILITY & UNIT ECONOMICS ═══════════════ */}
      <div className="dpr-page">
        <h2 className="dpr-section-title">4. Enterprise Viability Assessment</h2>

        <h3 className="dpr-subsection">4.1 Unit Economics</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">Estimated Monthly Revenue</td><td className="dpr-value-bold">₹{formatINR(vm?.estimatedMonthlyRevenue || 0)}</td></tr>
            <tr><td className="dpr-label">Estimated Monthly Operating Expenses</td><td>₹{formatINR(vm?.estimatedMonthlyExpenses || 0)}</td></tr>
            <tr><td className="dpr-label">Net Monthly Surplus</td><td className="dpr-value-bold">₹{formatINR(vm?.netMonthlySurplus || 0)}</td></tr>
            <tr><td className="dpr-label">Monthly EMI Obligation</td><td>₹{formatINR(fs.estimatedEMI)}</td></tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">4.2 Debt Service Coverage Ratio (DSCR)</h3>
        <table className="dpr-table">
          <tbody>
            <tr><td className="dpr-label">DSCR Value</td><td className="dpr-value-bold">{vm?.dscr?.toFixed(2) || '—'}</td></tr>
            <tr><td className="dpr-label">Viability Rating</td><td className="dpr-value-bold">{vm?.viabilityRating || '—'}</td></tr>
            <tr><td className="dpr-label">Break-Even Period</td><td>{vm?.breakEvenMonths || '—'} months</td></tr>
          </tbody>
        </table>
        <p className="dpr-note">
          {vm?.viabilityRating === 'STRONG'
            ? 'The enterprise demonstrates strong debt-servicing capability. Net monthly surplus comfortably exceeds EMI obligations (DSCR > 1.5). Recommended for sanction.'
            : vm?.viabilityRating === 'MODERATE'
            ? 'The enterprise shows moderate viability. Surplus covers EMI but with limited buffer (1.0 ≤ DSCR ≤ 1.5). Close monitoring recommended post-disbursement.'
            : 'Revenue projections indicate that the enterprise may face difficulty in meeting EMI obligations (DSCR < 1.0). Additional income sources or project restructuring may be required.'}
        </p>
      </div>

      {/* ═══════════════ PAGE 6: DECLARATION & BANK CHECKLIST ═══════════════ */}
      <div className="dpr-page">
        <h2 className="dpr-section-title">5. Declaration & Bank Sanction Checklist</h2>

        <h3 className="dpr-subsection">5.1 Bank Sanction Checklist</h3>
        <table className="dpr-table">
          <thead><tr><th>Sr.</th><th>Document / Verification Item</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Aadhaar Card (Original + Photocopy)</td><td>☐</td></tr>
            <tr><td>2</td><td>PAN Card / Form 60</td><td>☐</td></tr>
            <tr><td>3</td><td>Bank Passbook / Statement (6 months)</td><td>☐</td></tr>
            <tr><td>4</td><td>Passport-size Photographs (3 nos.)</td><td>☐</td></tr>
            <tr><td>5</td><td>Caste / Category Certificate (if applicable)</td><td>☐</td></tr>
            <tr><td>6</td><td>Project Site Verification by Field Officer</td><td>☐</td></tr>
            <tr><td>7</td><td>Quotation from Equipment / Machinery Supplier</td><td>☐</td></tr>
            <tr><td>8</td><td>EDP / Skill Training Certificate</td><td>☐</td></tr>
            <tr><td>9</td><td>Margin Money Receipt / Proof of Contribution</td><td>☐</td></tr>
            <tr><td>10</td><td>NOC from Local Body / Gram Panchayat (if required)</td><td>☐</td></tr>
          </tbody>
        </table>

        <h3 className="dpr-subsection">5.2 Applicant's Declaration</h3>
        <div className="dpr-declaration">
          <p>
            I, <strong>{applicantName || '___________________________'}</strong>, hereby declare that the information
            provided in this Detailed Project Report is true and correct to the best of my knowledge. I understand that
            any misrepresentation may result in the cancellation of the loan application and recovery of disbursed amount.
          </p>
          <div className="dpr-signature-block">
            <div>
              <p>Date: {today()}</p>
              <p>Place: {location}</p>
            </div>
            <div>
              <p className="dpr-sig-line">_____________________________</p>
              <p>Signature of Applicant</p>
            </div>
          </div>
        </div>

        <h3 className="dpr-subsection">5.3 Recommending Officer</h3>
        <div className="dpr-declaration">
          <div className="dpr-signature-block">
            <div>
              <p>Name: _____________________________</p>
              <p>Designation: _____________________________</p>
              <p>Office: District Industries Centre (DIC) / Bank Branch</p>
            </div>
            <div>
              <p className="dpr-sig-line">_____________________________</p>
              <p>Signature & Seal</p>
            </div>
          </div>
        </div>

        <div className="dpr-footer-note">
          <p>This DPR was generated using the <strong>Gramin Udyam Sahayak</strong> AI-powered advisory platform.</p>
          <p>Report generated on: {today()} | For queries, contact: National Rural Credit Helpline 1800-180-1111</p>
        </div>
      </div>
    </div>
  );
}
