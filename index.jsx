import { useState, useEffect, useRef, useCallback } from "react";

const API_KEY_PLACEHOLDER = ""; // handled by proxy

// â”€â”€ Palette & tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = {
  ink: "#0A0F1E",
  inkLight: "#141929",
  panel: "#111827",
  border: "#1E2D45",
  accent: "#0EA5E9",
  accentWarm: "#F59E0B",
  accentGreen: "#10B981",
  accentRed: "#EF4444",
  textPrimary: "#F0F6FF",
  textMuted: "#6B8EAE",
  textDim: "#3A5068",
};

// â”€â”€ Utility helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt = {
  currency: (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n),
  pct: (n, d = 2) => `${n.toFixed(d)}%`,
  num: (n) => new Intl.NumberFormat("en-US").format(Math.round(n)),
};

function calcMonthly(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcAmortization(principal, annualRate, years, extraMonthly = 0) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const basePayment = calcMonthly(principal, annualRate, years);
  const payment = basePayment + extraMonthly;
  let balance = principal;
  let totalInterest = 0;
  const schedule = [];
  for (let i = 1; i <= n && balance > 0; i++) {
    const interest = balance * r;
    const principal_paid = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - principal_paid);
    totalInterest += interest;
    if (i % 12 === 0 || balance === 0) {
      schedule.push({ year: Math.ceil(i / 12), balance, totalInterest, payment });
    }
    if (balance === 0) break;
  }
  return { schedule, totalInterest, monthsToPayoff: schedule.length * 12 };
}

// â”€â”€ Mock lender data factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getLenders(baseRate) {
  return [
    { name: "Rocket Mortgage", rate: baseRate, apr: baseRate + 0.12, type: "30-yr Fixed", lenderFee: 1200, rating: 4.8, logo: "ðŸš€" },
    { name: "Better.com", rate: baseRate - 0.08, apr: baseRate + 0.04, type: "30-yr Fixed", lenderFee: 0, rating: 4.7, logo: "âœ¦" },
    { name: "Chase Bank", rate: baseRate + 0.05, apr: baseRate + 0.18, type: "30-yr Fixed", lenderFee: 995, rating: 4.5, logo: "ðŸ¦" },
    { name: "LoanDepot", rate: baseRate - 0.12, apr: baseRate + 0.02, type: "30-yr Fixed", lenderFee: 500, rating: 4.6, logo: "â—ˆ" },
    { name: "Pennymac", rate: baseRate + 0.10, apr: baseRate + 0.22, type: "30-yr Fixed", lenderFee: 1500, rating: 4.4, logo: "â—†" },
    { name: "United Wholesale", rate: baseRate - 0.04, apr: baseRate + 0.09, type: "30-yr Fixed", lenderFee: 750, rating: 4.7, logo: "â—‰" },
  ].sort((a, b) => a.rate - b.rate);
}

// â”€â”€ Shared UI atoms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Badge({ children, color = C.accent }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

function Input({ label, value, onChange, prefix, suffix, type = "text", min, max, step }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {prefix && <span style={{ position: "absolute", left: 12, color: C.textMuted, fontSize: 15, fontWeight: 600, pointerEvents: "none" }}>{prefix}</span>}
        <input
          type={type} value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          style={{
            width: "100%", background: C.inkLight, border: `1.5px solid ${C.border}`,
            borderRadius: 8, color: C.textPrimary, fontSize: 16, fontWeight: 500,
            padding: prefix ? "10px 12px 10px 28px" : suffix ? "10px 40px 10px 12px" : "10px 12px",
            outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = C.accent}
          onBlur={(e) => e.target.style.borderColor = C.border}
        />
        {suffix && <span style={{ position: "absolute", right: 12, color: C.textMuted, fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.inkLight, border: `1.5px solid ${C.border}`, borderRadius: 8,
          color: C.textPrimary, fontSize: 15, padding: "10px 12px", outline: "none",
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: accent ? C.accent + "15" : C.panel,
      border: `1px solid ${accent ? C.accent + "44" : C.border}`,
      borderRadius: 12, padding: "16px 20px",
    }}>
      <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ? C.accent : C.textPrimary, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, format }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.accent, cursor: "pointer", height: 4 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: C.textDim }}>{format ? format(min) : min}</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS = [
  { id: "rates", label: "Rate Compare", icon: "â—Ž" },
  { id: "calculators", label: "Calculators", icon: "âŠž" },
  { id: "simulator", label: "Scenario Sim", icon: "âŸ" },
  { id: "advisor", label: "AI Advisor", icon: "âœ¦" },
];

function Nav({ active, setActive }) {
  return (
    <nav style={{
      display: "flex", gap: 4, background: C.panel,
      border: `1px solid ${C.border}`, borderRadius: 12, padding: 4,
      flexWrap: "wrap",
    }}>
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setActive(t.id)}
          style={{
            flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
            transition: "all 0.2s",
            background: active === t.id ? C.accent : "transparent",
            color: active === t.id ? "#fff" : C.textMuted,
          }}>
          <span>{t.icon}</span><span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// â”€â”€ 1. RATE COMPARISON ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RateComparison() {
  const [homePrice, setHomePrice] = useState(450000);
  const [downPct, setDownPct] = useState(20);
  const [creditScore, setCreditScore] = useState("740-759");
  const [loanType, setLoanType] = useState("30-yr Fixed");
  const [zip, setZip] = useState("90210");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const downPayment = homePrice * (downPct / 100);
  const loanAmount = homePrice - downPayment;

  // Derive base rate from credit score
  const baseRates = { "760+": 6.72, "740-759": 6.89, "720-739": 7.05, "700-719": 7.28, "680-699": 7.52, "660-679": 7.91 };
  const baseRate = baseRates[creditScore] || 7.0;
  const lenders = getLenders(baseRate);

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setSearched(true); }, 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: C.textPrimary, margin: 0, letterSpacing: "-0.03em" }}>
          Live Rate Comparison
        </h2>
        <p style={{ color: C.textMuted, margin: "6px 0 0", fontSize: 14 }}>
          Compare today's mortgage rates from top lenders â€” updated in real time.
        </p>
      </div>

      {/* Input Form */}
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24,
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16,
      }}>
        <Input label="Home Price" value={homePrice} onChange={setHomePrice} prefix="$" type="number" step={5000} />
        <div>
          <Slider label="Down Payment" value={downPct} onChange={setDownPct} min={3} max={40} format={(v) => `${v}% Â· ${fmt.currency(homePrice * v / 100)}`} />
        </div>
        <Input label="ZIP Code" value={zip} onChange={setZip} />
        <Select label="Credit Score" value={creditScore} onChange={setCreditScore}
          options={["760+", "740-759", "720-739", "700-719", "680-699", "660-679"].map(v => ({ value: v, label: v }))} />
        <Select label="Loan Type" value={loanType} onChange={setLoanType}
          options={["30-yr Fixed", "15-yr Fixed", "5/1 ARM", "7/1 ARM", "FHA 30-yr", "VA 30-yr"].map(v => ({ value: v, label: v }))} />
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button onClick={handleSearch}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
              background: C.accent, color: "#fff", fontSize: 14, fontWeight: 800,
              cursor: "pointer", letterSpacing: "0.04em", fontFamily: "inherit",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => e.target.style.opacity = "0.85"}
            onMouseOut={(e) => e.target.style.opacity = "1"}
          >
            {loading ? "Searchingâ€¦" : "Compare Rates â†’"}
          </button>
        </div>
      </div>

      {/* Loan summary chips */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Badge>Loan: {fmt.currency(loanAmount)}</Badge>
        <Badge color={C.accentWarm}>Down: {fmt.currency(downPayment)} ({downPct}%)</Badge>
        <Badge color={C.accentGreen}>Credit: {creditScore}</Badge>
        <Badge color="#A78BFA">{loanType}</Badge>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
              {lenders.length} Lenders Found
            </h3>
            <span style={{ fontSize: 12, color: C.textDim }}>Sorted by lowest rate</span>
          </div>
          {lenders.map((l, i) => {
            const monthly = calcMonthly(loanAmount, l.rate, 30);
            return (
              <div key={l.name} style={{
                background: i === 0 ? C.accent + "0D" : C.panel,
                border: `1.5px solid ${i === 0 ? C.accent + "55" : C.border}`,
                borderRadius: 14, padding: "16px 20px",
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
                gap: 12, alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{l.logo}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{l.type} Â· â˜… {l.rating}</div>
                    {i === 0 && <Badge color={C.accentGreen}>Best Rate</Badge>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: i === 0 ? C.accent : C.textPrimary, letterSpacing: "-0.02em" }}>{fmt.pct(l.rate)}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>Rate</div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{fmt.pct(l.apr)}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>APR</div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{fmt.currency(monthly)}/mo</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>Monthly</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{l.lenderFee === 0 ? "No fee" : fmt.currency(l.lenderFee)}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>Lender fee</div>
                </div>
                <button style={{
                  padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.accent}`,
                  background: i === 0 ? C.accent : "transparent",
                  color: i === 0 ? "#fff" : C.accent,
                  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}>
                  Get Rate
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's rate snapshot */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Today's National Averages
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {[
            { type: "30-yr Fixed", rate: "6.89%", change: "+0.04" },
            { type: "15-yr Fixed", rate: "6.21%", change: "-0.02" },
            { type: "5/1 ARM", rate: "6.44%", change: "+0.01" },
            { type: "FHA 30-yr", rate: "6.55%", change: "0.00" },
            { type: "Jumbo 30-yr", rate: "7.12%", change: "+0.06" },
          ].map((r) => (
            <div key={r.type} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>{r.rate}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.type}</div>
              <div style={{ fontSize: 11, color: r.change.startsWith("+") ? C.accentRed : r.change.startsWith("-") ? C.accentGreen : C.textDim, marginTop: 2 }}>
                {r.change} today
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ 2. CALCULATOR HUB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CALCS = [
  { id: "mortgage", label: "Mortgage Payment", icon: "ðŸ " },
  { id: "affordability", label: "Affordability", icon: "ðŸ’°" },
  { id: "refinance", label: "Refinance Savings", icon: "â™»ï¸" },
  { id: "extra", label: "Extra Payment", icon: "âš¡" },
  { id: "amortization", label: "Amortization", icon: "ðŸ“Š" },
  { id: "rentbuy", label: "Rent vs Buy", icon: "âš–ï¸" },
  { id: "closing", label: "Closing Costs", icon: "ðŸ“‹" },
  { id: "arm", label: "ARM vs Fixed", icon: "ðŸ“ˆ" },
];

function MortgageCalc() {
  const [hp, setHp] = useState(450000);
  const [dp, setDp] = useState(90000);
  const [rate, setRate] = useState(6.89);
  const [term, setTerm] = useState(30);
  const loan = hp - dp;
  const monthly = calcMonthly(loan, rate, term);
  const tax = hp * 0.012 / 12;
  const insurance = hp * 0.005 / 12;
  const pmi = dp / hp < 0.2 ? loan * 0.005 / 12 : 0;
  const total = monthly + tax + insurance + pmi;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Home Price" value={hp} onChange={setHp} prefix="$" type="number" step={5000} />
        <Input label="Down Payment" value={dp} onChange={setDp} prefix="$" type="number" step={5000} />
        <Input label="Interest Rate" value={rate} onChange={setRate} suffix="%" type="number" step={0.01} />
        <Select label="Loan Term" value={term} onChange={(v) => setTerm(Number(v))}
          options={[{ value: 30, label: "30 Years" }, { value: 20, label: "20 Years" }, { value: 15, label: "15 Years" }, { value: 10, label: "10 Years" }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Principal & Interest" value={fmt.currency(monthly)} accent />
        <StatCard label="Property Tax" value={fmt.currency(tax)} sub="Est. 1.2% annually" />
        <StatCard label="Home Insurance" value={fmt.currency(insurance)} sub="Est. 0.5% annually" />
        {pmi > 0 && <StatCard label="PMI" value={fmt.currency(pmi)} sub="<20% down required" />}
        <StatCard label="Total Monthly" value={fmt.currency(total)} />
        <StatCard label="Loan Amount" value={fmt.currency(loan)} sub={`${((dp / hp) * 100).toFixed(0)}% down`} />
      </div>
      <div style={{ background: C.inkLight, borderRadius: 10, padding: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>Total paid over {term} years:</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.accentWarm }}>{fmt.currency(monthly * term * 12)}</span>
        <span style={{ fontSize: 13, color: C.textDim }}>Â· Interest paid:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.accentRed }}>{fmt.currency(monthly * term * 12 - loan)}</span>
      </div>
    </div>
  );
}

function AffordabilityCalc() {
  const [income, setIncome] = useState(120000);
  const [monthlyDebts, setMonthlyDebts] = useState(500);
  const [rate, setRate] = useState(6.89);
  const [dp, setDp] = useState(60000);
  const maxMonthlyPI = (income / 12) * 0.28;
  const maxTotalDebt = (income / 12) * 0.43 - monthlyDebts;
  const maxPayment = Math.min(maxMonthlyPI, maxTotalDebt);
  const r = rate / 100 / 12;
  const n = 30 * 12;
  const maxLoan = maxPayment * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  const maxHome = maxLoan + dp;
  const dti = ((monthlyDebts + maxPayment) / (income / 12)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Annual Income" value={income} onChange={setIncome} prefix="$" type="number" step={5000} />
        <Input label="Monthly Debts" value={monthlyDebts} onChange={setMonthlyDebts} prefix="$" type="number" step={50} />
        <Input label="Down Payment Saved" value={dp} onChange={setDp} prefix="$" type="number" step={5000} />
        <Input label="Interest Rate" value={rate} onChange={setRate} suffix="%" type="number" step={0.01} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Max Home Price" value={fmt.currency(maxHome)} accent />
        <StatCard label="Max Loan Amount" value={fmt.currency(maxLoan)} />
        <StatCard label="Max Monthly Payment" value={fmt.currency(maxPayment)} sub="28% front-end ratio" />
        <StatCard label="DTI Ratio" value={fmt.pct(dti, 0)} sub={dti <= 43 ? "âœ“ Within guidelines" : "âš  Above 43%"} />
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>Affordability Range</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[0.8, 0.9, 1.0, 1.1].map(m => (
            <div key={m} style={{ flex: "1 1 auto", background: m === 1 ? C.accent + "20" : C.inkLight, border: `1px solid ${m === 1 ? C.accent + "44" : C.border}`, borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: m === 1 ? C.accent : C.textPrimary }}>{fmt.currency(maxHome * m)}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{m === 1 ? "Recommended" : m < 1 ? "Conservative" : "Stretch"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RefinanceCalc() {
  const [currentRate, setCurrentRate] = useState(7.5);
  const [newRate, setNewRate] = useState(6.5);
  const [balance, setBalance] = useState(380000);
  const [closingCosts, setClosingCosts] = useState(5500);
  const currentMonthly = calcMonthly(balance, currentRate, 30);
  const newMonthly = calcMonthly(balance, newRate, 30);
  const savings = currentMonthly - newMonthly;
  const breakeven = closingCosts / savings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Current Rate" value={currentRate} onChange={setCurrentRate} suffix="%" type="number" step={0.01} />
        <Input label="New Rate" value={newRate} onChange={setNewRate} suffix="%" type="number" step={0.01} />
        <Input label="Remaining Balance" value={balance} onChange={setBalance} prefix="$" type="number" step={5000} />
        <Input label="Closing Costs" value={closingCosts} onChange={setClosingCosts} prefix="$" type="number" step={500} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Monthly Savings" value={fmt.currency(savings)} accent />
        <StatCard label="Current Payment" value={fmt.currency(currentMonthly)} />
        <StatCard label="New Payment" value={fmt.currency(newMonthly)} />
        <StatCard label="Break-even" value={`${breakeven.toFixed(1)} mo`} sub={savings > 0 ? (breakeven < 36 ? "âœ“ Worth it" : "Consider carefully") : "No savings"} />
        <StatCard label="5-yr Savings" value={fmt.currency(Math.max(0, savings * 60 - closingCosts))} />
        <StatCard label="Rate Drop" value={fmt.pct(currentRate - newRate)} sub="Percentage points" />
      </div>
    </div>
  );
}

function ExtraPaymentCalc() {
  const [loan, setLoan] = useState(380000);
  const [rate, setRate] = useState(6.89);
  const [extra, setExtra] = useState(300);
  const base = calcAmortization(loan, rate, 30, 0);
  const withExtra = calcAmortization(loan, rate, 30, extra);
  const interestSaved = base.totalInterest - withExtra.totalInterest;
  const yearsSaved = (base.schedule.length - withExtra.schedule.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Loan Amount" value={loan} onChange={setLoan} prefix="$" type="number" step={5000} />
        <Input label="Interest Rate" value={rate} onChange={setRate} suffix="%" type="number" step={0.01} />
        <Input label="Extra Monthly Payment" value={extra} onChange={setExtra} prefix="$" type="number" step={50} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Interest Saved" value={fmt.currency(interestSaved)} accent />
        <StatCard label="Years Saved" value={`${yearsSaved} yrs`} sub={`Pay off in ${withExtra.schedule.length} yrs`} />
        <StatCard label="Total Interest (Base)" value={fmt.currency(base.totalInterest)} />
        <StatCard label="Total Interest (w/ Extra)" value={fmt.currency(withExtra.totalInterest)} />
      </div>
      {/* Mini chart */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 14 }}>Balance Over Time</div>
        <div style={{ height: 120, display: "flex", alignItems: "flex-end", gap: 3 }}>
          {base.schedule.slice(0, 30).map((s, i) => {
            const h = (s.balance / loan) * 100;
            const hw = withExtra.schedule[i] ? (withExtra.schedule[i].balance / loan) * 100 : 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end" }}>
                <div style={{ flex: 1, height: `${h}%`, background: C.border, borderRadius: "2px 2px 0 0" }} />
                <div style={{ flex: 1, height: `${Math.max(hw, 0)}%`, background: C.accent + "88", borderRadius: "2px 2px 0 0" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 12, height: 12, background: C.border, borderRadius: 2 }} /><span style={{ fontSize: 12, color: C.textDim }}>Standard</span></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 12, height: 12, background: C.accent + "88", borderRadius: 2 }} /><span style={{ fontSize: 12, color: C.textDim }}>With Extra Payment</span></div>
        </div>
      </div>
    </div>
  );
}

function ClosingCostCalc() {
  const [hp, setHp] = useState(450000);
  const [state, setState] = useState("CA");
  const loanAmt = hp * 0.8;
  const costs = [
    { name: "Origination Fee", amount: loanAmt * 0.01, note: "~1% of loan" },
    { name: "Appraisal", amount: 600, note: "Fixed" },
    { name: "Title Insurance", amount: hp * 0.005, note: "~0.5%" },
    { name: "Escrow/Settlement", amount: 2200, note: "Fixed" },
    { name: "Recording Fees", amount: 350, note: "County" },
    { name: "Prepaid Interest", amount: loanAmt * 0.0689 / 365 * 15, note: "15 days avg" },
    { name: "Home Inspection", amount: 500, note: "Recommended" },
    { name: "HOA Transfer (if any)", amount: 500, note: "If applicable" },
  ];
  const total = costs.reduce((s, c) => s + c.amount, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Home Price" value={hp} onChange={setHp} prefix="$" type="number" step={5000} />
        <Select label="State" value={state} onChange={setState} options={["CA", "TX", "FL", "NY", "WA", "IL"].map(v => ({ value: v, label: v }))} />
      </div>
      <StatCard label="Total Estimated Closing Costs" value={fmt.currency(total)} sub={`${fmt.pct((total / hp) * 100)} of home price`} accent />
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {costs.map((c, i) => (
          <div key={c.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderBottom: i < costs.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{c.note}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{fmt.currency(c.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RentBuyCalc() {
  const [rent, setRent] = useState(2800);
  const [hp, setHp] = useState(450000);
  const [rate, setRate] = useState(6.89);
  const [years, setYears] = useState(7);
  const [appreciation, setAppreciation] = useState(3);
  const dp = hp * 0.2;
  const loan = hp - dp;
  const monthly = calcMonthly(loan, rate, 30);
  const tax = hp * 0.012 / 12;
  const insurance = hp * 0.005 / 12;
  const totalBuyMonthly = monthly + tax + insurance;
  const rentTotal = rent * 12 * years * Math.pow(1.03, years / 2);
  const futureValue = hp * Math.pow(1 + appreciation / 100, years);
  const equity = futureValue - (loan - calcAmortization(loan, rate, 30, 0).schedule[Math.min(years - 1, 29)]?.balance || 0);
  const buyNetCost = totalBuyMonthly * 12 * years - (equity - dp);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Current Rent" value={rent} onChange={setRent} prefix="$" type="number" step={100} />
        <Input label="Home Price" value={hp} onChange={setHp} prefix="$" type="number" step={5000} />
        <Input label="Interest Rate" value={rate} onChange={setRate} suffix="%" type="number" step={0.01} />
        <Slider label="Time Horizon" value={years} onChange={setYears} min={2} max={20} format={(v) => `${v} years`} />
        <Slider label="Home Appreciation" value={appreciation} onChange={setAppreciation} min={0} max={8} step={0.5} format={(v) => `${v}%/yr`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 12 }}>RENTING for {years} yrs</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accentRed }}>{fmt.currency(rentTotal)}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Total spent, nothing owned</div>
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 12 }}>BUYING for {years} yrs</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accentGreen }}>{fmt.currency(buyNetCost)}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Net cost after equity ({fmt.currency(equity)} built)</div>
        </div>
      </div>
      <div style={{ background: C.inkLight, borderRadius: 10, padding: 14 }}>
        <span style={{ fontSize: 14, color: C.textMuted }}>After {years} years, buying saves you approximately </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: buyNetCost < rentTotal ? C.accentGreen : C.accentRed }}>
          {fmt.currency(Math.abs(rentTotal - buyNetCost))}
        </span>
        <span style={{ fontSize: 14, color: C.textMuted }}> {buyNetCost < rentTotal ? "vs renting." : "less than renting."}</span>
      </div>
    </div>
  );
}

function ARMvsFixed() {
  const [loan, setLoan] = useState(380000);
  const [fixedRate, setFixedRate] = useState(6.89);
  const [armInitial, setArmInitial] = useState(5.75);
  const [armAdjusted, setArmAdjusted] = useState(7.5);
  const [armFixedYears, setArmFixedYears] = useState(5);
  const fixedMonthly = calcMonthly(loan, fixedRate, 30);
  const armMonthlyInit = calcMonthly(loan, armInitial, 30);
  const armMonthlyAdj = calcMonthly(loan, armAdjusted, 30);
  const savingsDuringFixed = (fixedMonthly - armMonthlyInit) * armFixedYears * 12;
  const costAfter = (armMonthlyAdj - fixedMonthly) * 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Input label="Loan Amount" value={loan} onChange={setLoan} prefix="$" type="number" step={5000} />
        <Input label="30-yr Fixed Rate" value={fixedRate} onChange={setFixedRate} suffix="%" type="number" step={0.01} />
        <Input label="ARM Initial Rate" value={armInitial} onChange={setArmInitial} suffix="%" type="number" step={0.01} />
        <Input label="ARM After Adjust" value={armAdjusted} onChange={setArmAdjusted} suffix="%" type="number" step={0.01} />
        <Select label="ARM Fixed Period" value={armFixedYears} onChange={(v) => setArmFixedYears(Number(v))}
          options={[{ value: 5, label: "5/1 ARM" }, { value: 7, label: "7/1 ARM" }, { value: 10, label: "10/1 ARM" }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Fixed Monthly" value={fmt.currency(fixedMonthly)} />
        <StatCard label="ARM Initial Mo." value={fmt.currency(armMonthlyInit)} accent />
        <StatCard label="ARM After Adjust" value={fmt.currency(armMonthlyAdj)} />
        <StatCard label={`Savings (${armFixedYears} yrs)`} value={fmt.currency(savingsDuringFixed)} sub="During fixed period" />
        <StatCard label="Extra Cost/yr After" value={fmt.currency(Math.max(0, costAfter))} sub="If rates rise" />
      </div>
      <div style={{ background: C.inkLight, borderRadius: 10, padding: 14, fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
        <strong style={{ color: C.accentWarm }}>ARM is better if:</strong> you plan to sell or refinance before year {armFixedYears}, or if rates fall. <br />
        <strong style={{ color: C.accentGreen }}>Fixed is better if:</strong> you plan to stay long-term or want payment certainty.
      </div>
    </div>
  );
}

function CalculatorHub() {
  const [activeCalc, setActiveCalc] = useState("mortgage");
  const calcMap = {
    mortgage: <MortgageCalc />,
    affordability: <AffordabilityCalc />,
    refinance: <RefinanceCalc />,
    extra: <ExtraPaymentCalc />,
    amortization: <ExtraPaymentCalc />,
    rentbuy: <RentBuyCalc />,
    closing: <ClosingCostCalc />,
    arm: <ARMvsFixed />,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: C.textPrimary, margin: 0, letterSpacing: "-0.03em" }}>Calculator Hub</h2>
        <p style={{ color: C.textMuted, margin: "6px 0 0", fontSize: 14 }}>Every mortgage calculation you'll ever need, in one place.</p>
      </div>
      {/* Calc picker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {CALCS.map((c) => (
          <button key={c.id} onClick={() => setActiveCalc(c.id)}
            style={{
              padding: "12px 10px", borderRadius: 10, border: `1.5px solid ${activeCalc === c.id ? C.accent : C.border}`,
              background: activeCalc === c.id ? C.accent + "15" : C.panel,
              color: activeCalc === c.id ? C.accent : C.textMuted,
              fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
              transition: "all 0.2s",
            }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      {/* Active calculator */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 20 }}>
          {CALCS.find(c => c.id === activeCalc)?.icon} {CALCS.find(c => c.id === activeCalc)?.label}
        </div>
        {calcMap[activeCalc]}
      </div>
    </div>
  );
}

// â”€â”€ 3. SCENARIO SIMULATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScenarioSimulator() {
  const [loan, setLoan] = useState(380000);
  const [baseRate, setBaseRate] = useState(7.2);
  const [compareRate, setCompareRate] = useState(6.4);
  const [extraPayment, setExtraPayment] = useState(300);
  const [scenario, setScenario] = useState("rate_drop");

  const scenarios = [
    { id: "rate_drop", label: "Rate Drop", desc: "What if rates fell?" },
    { id: "extra_pay", label: "Extra Payments", desc: "Pay off faster" },
    { id: "refi", label: "Refinance Now?", desc: "Break-even analysis" },
    { id: "downturn", label: "Market Dip", desc: "Home value scenarios" },
  ];

  const baseMonthly = calcMonthly(loan, baseRate, 30);
  const compareMonthly = calcMonthly(loan, compareRate, 30);
  const monthlySaving = baseMonthly - compareMonthly;

  const baseAmort = calcAmortization(loan, baseRate, 30);
  const extraAmort = calcAmortization(loan, baseRate, 30, extraPayment);
  const interestSaved = baseAmort.totalInterest - extraAmort.totalInterest;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: C.textPrimary, margin: 0, letterSpacing: "-0.03em" }}>Scenario Simulator</h2>
        <p style={{ color: C.textMuted, margin: "6px 0 0", fontSize: 14 }}>Run "what-if" simulations. See the real financial impact of every decision.</p>
      </div>

      {/* Scenario picker */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {scenarios.map(s => (
          <button key={s.id} onClick={() => setScenario(s.id)}
            style={{
              padding: "10px 18px", borderRadius: 30, border: `1.5px solid ${scenario === s.id ? C.accent : C.border}`,
              background: scenario === s.id ? C.accent : "transparent",
              color: scenario === s.id ? "#fff" : C.textMuted,
              fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer",
              transition: "all 0.2s",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {scenario === "rate_drop" && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, color: C.textMuted }}>
            <span style={{ fontWeight: 700, color: C.accentWarm }}>Scenario: </span>
            What happens if rates drop from {fmt.pct(baseRate)} to {fmt.pct(compareRate)}?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <Input label="Loan Amount" value={loan} onChange={setLoan} prefix="$" type="number" step={5000} />
            <Input label="Current Rate" value={baseRate} onChange={setBaseRate} suffix="%" type="number" step={0.1} />
            <Input label="New Rate" value={compareRate} onChange={setCompareRate} suffix="%" type="number" step={0.1} />
          </div>
          {/* Visual rate comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
            <div style={{ background: C.inkLight, borderRadius: 12, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.textDim, fontWeight: 600, marginBottom: 8 }}>AT {fmt.pct(baseRate)}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.textPrimary }}>{fmt.currency(baseMonthly)}</div>
              <div style={{ fontSize: 13, color: C.textDim }}>per month</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, color: C.accentGreen }}>â†’</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.accentGreen, marginTop: 4 }}>
                -{fmt.currency(monthlySaving)}/mo
              </div>
            </div>
            <div style={{ background: C.accentGreen + "15", border: `1.5px solid ${C.accentGreen + "44"}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.accentGreen, fontWeight: 600, marginBottom: 8 }}>AT {fmt.pct(compareRate)}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.accentGreen }}>{fmt.currency(compareMonthly)}</div>
              <div style={{ fontSize: 13, color: C.textDim }}>per month</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <StatCard label="Annual Savings" value={fmt.currency(monthlySaving * 12)} />
            <StatCard label="5-yr Savings" value={fmt.currency(monthlySaving * 60)} />
            <StatCard label="30-yr Savings" value={fmt.currency(monthlySaving * 360)} />
          </div>
        </div>
      )}

      {scenario === "extra_pay" && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, color: C.textMuted }}>
            <span style={{ fontWeight: 700, color: C.accentWarm }}>Scenario: </span>
            What if I add {fmt.currency(extraPayment)}/month extra toward principal?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <Input label="Loan Amount" value={loan} onChange={setLoan} prefix="$" type="number" step={5000} />
            <Input label="Interest Rate" value={baseRate} onChange={setBaseRate} suffix="%" type="number" step={0.1} />
            <Slider label="Extra Monthly" value={extraPayment} onChange={setExtraPayment} min={0} max={2000} step={50} format={(v) => fmt.currency(v)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <StatCard label="Interest Saved" value={fmt.currency(interestSaved)} accent />
            <StatCard label="Years Saved" value={`${30 - extraAmort.schedule.length} yrs`} />
            <StatCard label="Payoff in" value={`${extraAmort.schedule.length} yrs`} sub={`vs 30 yrs standard`} />
            <StatCard label="Monthly Added" value={fmt.currency(extraPayment)} />
          </div>
          {/* Balance trajectory bar chart */}
          <div style={{ background: C.inkLight, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 12 }}>Remaining Balance by Year</div>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 100 }}>
              {Array.from({ length: 30 }, (_, i) => {
                const bBase = baseAmort.schedule[i]?.balance || 0;
                const bExtra = extraAmort.schedule[i]?.balance || 0;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <div style={{ width: "100%", display: "flex", gap: 1, alignItems: "flex-end", height: 90 }}>
                      <div style={{ flex: 1, height: `${(bBase / loan) * 90}px`, background: C.border + "88", borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
                      <div style={{ flex: 1, height: `${(bExtra / loan) * 90}px`, background: C.accent + "77", borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
                    </div>
                    {(i + 1) % 5 === 0 && <span style={{ fontSize: 9, color: C.textDim }}>{i + 1}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 12, height: 12, background: C.border + "88", borderRadius: 2 }} /><span style={{ fontSize: 12, color: C.textDim }}>Standard</span></div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 12, height: 12, background: C.accent + "77", borderRadius: 2 }} /><span style={{ fontSize: 12, color: C.textDim }}>With +{fmt.currency(extraPayment)}/mo</span></div>
            </div>
          </div>
        </div>
      )}

      {scenario === "refi" && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <RefinanceCalc />
        </div>
      )}

      {scenario === "downturn" && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 15, color: C.textMuted }}>
            <span style={{ fontWeight: 700, color: C.accentWarm }}>Scenario: </span>
            How does your equity change across different market conditions?
          </div>
          <Input label="Home Price" value={loan + 90000} onChange={(v) => setLoan(v - 90000)} prefix="$" type="number" step={5000} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            {[-20, -10, 0, 5, 10, 20].map(pct => {
              const hp = (loan + 90000);
              const newHp = hp * (1 + pct / 100);
              const equity = newHp - loan;
              const positive = equity > 0;
              return (
                <div key={pct} style={{
                  background: positive ? C.accentGreen + "12" : C.accentRed + "12",
                  border: `1.5px solid ${positive ? C.accentGreen + "44" : C.accentRed + "44"}`,
                  borderRadius: 12, padding: 16, textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: pct >= 0 ? C.accentGreen : C.accentRed }}>
                    {pct > 0 ? "+" : ""}{pct}%
                  </div>
                  <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700, marginTop: 4 }}>{fmt.currency(newHp)}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Home Value</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: positive ? C.accentGreen : C.accentRed, marginTop: 6 }}>
                    {fmt.currency(equity)} equity
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€ 4. AI MORTGAGE ADVISOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUGGESTED = [
  "Can I afford a $650k home with $140k income?",
  "Should I refinance from 7.5% to 6.5%?",
  "What happens if I put 10% vs 20% down?",
  "Is it better to buy or rent in 2026?",
  "How much does 1% rate difference cost over 30 years?",
  "What credit score do I need for the best rate?",
];

function AIAdvisor() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your AI mortgage advisor. Ask me anything â€” affordability, rates, refinancing, strategy, or run a custom scenario. I'll give you a real financial breakdown, not just generic advice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const systemPrompt = `You are an expert AI mortgage advisor embedded in homeloansrate.com. You help users understand mortgage rates, affordability, refinancing, and home buying decisions.

When answering:
- Give concrete numbers and calculations when possible
- Use realistic 2026 mortgage rate data (30-yr fixed around 6.7-7.2%, 15-yr around 6.1-6.5%)
- Structure your response with clear sections using headers like **Section Name:**
- Show specific math when helpful (e.g., monthly payment formula results)
- Be direct and actionable â€” tell them what to do, not just what's possible
- Include 2-3 "Next Actions" at the end of detailed answers
- Keep responses focused and under 400 words unless complexity demands more
- Use dollar amounts and percentages specifically, not vague ranges
- Be warm and human, not robotic`;

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't process that. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <div key={i} style={{ fontWeight: 800, color: C.accent, marginTop: 12, marginBottom: 4, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>{line.replace(/\*\*/g, "")}</div>;
      }
      if (line.match(/^\*\*.*\*\*/)) {
        return <div key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${C.textPrimary}">$1</strong>`) }} />;
      }
      if (line.startsWith("- ")) {
        return <div key={i} style={{ paddingLeft: 16, marginBottom: 3, color: C.textMuted, position: "relative" }}>
          <span style={{ position: "absolute", left: 4, color: C.accent }}>Â·</span>
          {line.slice(2)}
        </div>;
      }
      return line ? <div key={i} style={{ marginBottom: 6 }}>{line}</div> : <div key={i} style={{ height: 6 }} />;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: C.textPrimary, margin: 0, letterSpacing: "-0.03em" }}>AI Mortgage Advisor</h2>
          <Badge color={C.accentGreen}>LIVE</Badge>
        </div>
        <p style={{ color: C.textMuted, margin: "6px 0 0", fontSize: 14 }}>Powered by Claude Â· Ask anything about mortgages, rates, and home buying strategy.</p>
      </div>

      {/* Chat */}
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
        display: "flex", flexDirection: "column", height: 440,
      }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "82%",
                background: m.role === "user" ? C.accent : C.inkLight,
                border: `1px solid ${m.role === "user" ? C.accent : C.border}`,
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "12px 16px",
                fontSize: 14, color: C.textPrimary, lineHeight: 1.6,
              }}>
                {m.role === "assistant" ? formatMessage(m.content) : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: C.inkLight, borderRadius: "16px 16px 16px 4px", width: "fit-content", border: `1px solid ${C.border}` }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%", background: C.accent,
                  animation: `pulse ${0.6 + i * 0.2}s ease-in-out infinite alternate`,
                }} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about rates, affordability, refinancingâ€¦"
            style={{
              flex: 1, background: C.inkLight, border: `1.5px solid ${C.border}`,
              borderRadius: 10, color: C.textPrimary, fontSize: 14, padding: "10px 14px",
              outline: "none", fontFamily: "inherit",
            }}
            onFocus={(e) => e.target.style.borderColor = C.accent}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: loading || !input.trim() ? C.border : C.accent,
              color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}>
            Send
          </button>
        </div>
      </div>

      {/* Suggested questions */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Suggested Questions
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUGGESTED.map((q) => (
            <button key={q} onClick={() => sendMessage(q)}
              style={{
                padding: "8px 14px", borderRadius: 20,
                border: `1.5px solid ${C.border}`, background: "transparent",
                color: C.textMuted, fontSize: 13, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.2s",
              }}
              onMouseOver={(e) => { e.target.style.borderColor = C.accent; e.target.style.color = C.accent; }}
              onMouseOut={(e) => { e.target.style.borderColor = C.border; e.target.style.color = C.textMuted; }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes pulse { from { opacity: 0.3 } to { opacity: 1 } }`}</style>
    </div>
  );
}

// â”€â”€ ROOT APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [tab, setTab] = useState("rates");

  const views = {
    rates: <RateComparison />,
    calculators: <CalculatorHub />,
    simulator: <ScenarioSimulator />,
    advisor: <AIAdvisor />,
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.ink, fontFamily: "'Georgia', 'Times New Roman', serif",
      color: C.textPrimary, padding: 0,
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, background: C.panel,
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: C.textPrimary }}>
              home<span style={{ color: C.accent }}>loans</span>rate
            </span>
            <span style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>.com</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              <span style={{ color: C.accentGreen }}>â—</span> 30-yr Fixed: <strong style={{ color: C.textPrimary }}>6.89%</strong>
            </div>
            <button style={{
              padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${C.accent}`,
              background: "transparent", color: C.accent, fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Get Pre-Approved
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {/* Live rate ticker */}
        <div style={{
          background: C.accent + "10", border: `1px solid ${C.accent + "30"}`,
          borderRadius: 10, padding: "10px 16px", marginBottom: 24,
          display: "flex", gap: 24, overflowX: "auto", flexWrap: "wrap",
        }}>
          {[
            { label: "30-yr Fixed", rate: "6.89%", dir: "â–²" },
            { label: "15-yr Fixed", rate: "6.21%", dir: "â–¼" },
            { label: "FHA 30-yr", rate: "6.55%", dir: "â–²" },
            { label: "VA 30-yr", rate: "6.31%", dir: "â€”" },
            { label: "5/1 ARM", rate: "6.44%", dir: "â–²" },
            { label: "Jumbo", rate: "7.12%", dir: "â–²" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{r.rate}</span>
              <span style={{ fontSize: 11, color: r.dir === "â–¼" ? C.accentGreen : r.dir === "â–²" ? C.accentRed : C.textDim }}>{r.dir}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>Updated May 11, 2026</span>
        </div>

        <Nav active={tab} setActive={setTab} />
        <div style={{ marginTop: 28 }}>{views[tab]}</div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.textDim }}>
            Â© 2026 homeloansrate.com Â· Rates are for informational purposes. Not financial advice.
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {["Privacy", "Terms", "Advertise", "Contact"].map(l => (
              <span key={l} style={{ fontSize: 12, color: C.textDim, cursor: "pointer" }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
