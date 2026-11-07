# AGENTS.md — Philippine Payroll System Specification

Compact technical guide and architectural specification for AI agents and developers working on this codebase.

---

## 1. System Architecture & Tech Stack

- **Pattern:** Vertical Slice Architecture (Feature slices with Minimal APIs; no MediatR/CQRS indirection).
- **Backend:** .NET 10 Web API (`backend/src/Payroll.Api`), C#, FluentValidation, Entity Framework Core 10.
- **Database:** PostgreSQL 16 (`Data/PayrollDbContext.cs`).
  - *Invariant:* All monetary and calculation figures **must** use `decimal` in C# and `NUMERIC(18,4)` in PostgreSQL.
- **Frontend:** React 19 + TypeScript + Vite (`frontend/`), Tailwind CSS, `shadcn/ui` (Radix primitives), TanStack Table.
  - *Routing & Layout:* `frontend/src/app/dashboard/layout.tsx` + `frontend/src/features/*`.

---

## 2. Directory Layout & Key Modules

```
payroll/
├── backend/src/Payroll.Api/
│   ├── Common/              # JWT Auth, UserContext, Formula Evaluator
│   ├── Data/                # DbContext, EF Migrations, ModelBuilder, Seeds
│   │   ├── Entities/        # Core relational data models
│   │   └── Seed/            # Initial statutory brackets (SSS, PhilHealth, Pag-IBIG, Tax)
│   └── Features/            # Minimal API endpoints grouped by vertical slice:
│       ├── Auth/            # JWT login, refresh tokens, RBAC endpoints
│       ├── Employees/       # Employee directory, bulk generation, dynamic perks/deductions
│       ├── Timekeeping/     # Clock-in/out, attendance, leave accrual, overtime
│       ├── PayrollEngine/   # Cutoff computation engine, grouped earnings & deductions
│       ├── StatutoryAndTax/ # Dynamic formula evaluator, SSS, HDMF, PhilHealth, BIR TRAIN
│       ├── PayrollApproval/ # Multi-tier approval pipeline (Draft -> Finalized), audit logs
│       ├── Reports/         # Payslips, bank batch files (BDO/BPI/etc.), statutory reports
│       └── LoansAndBenefits/# Loans (SSS/HDMF/Company), De Minimis benefits, 13th-month pay
└── frontend/src/
    ├── app/                 # Root app & dashboard layout
    ├── components/ui/       # shadcn/ui shared design system primitives
    └── features/            # Feature pages corresponding to backend slices
```

---

## 3. Core Domain & Business Rules

### 3.1 Authentication & RBAC
- **Roles:** `Admin`, `HR`, `PayrollOfficer`, `Manager`, `Employee`.
- Authorization enforced via ASP.NET Core policies (`RequireRole(...)`).
- Employees can be linked to a User account for self-service payslip viewing.

### 3.2 Dynamic Earnings & Deductions
- **Entity:** `AllowanceType` (`Category = Earning | Deduction`).
- **Groups:**
  - *Earnings:* `Allowance`, `Bonus & Incentive`.
  - *Deductions:* `Loan & Cash Advance`, `Benefit Deduction`, `Other Deduction`.
- Assigned individually per employee with effective rates and frequencies (`EveryCutoff`, `FirstCutoffOnly`, `SecondCutoffOnly`).

### 3.3 Statutory Contributions & Tax (Philippine Compliance)
- **Engine:** Dynamic `ContributionFormulaEvaluator` with effective-dated schedules and salary bracket tables.
  - **SSS:** Salary credit tiers with employer/employee share, Employee Compensation (EC), and WISP/MPF.
  - **PhilHealth:** Percentage-based calculation clamped between statutory floor and ceiling, split 50/50.
  - **Pag-IBIG (HDMF):** Statutory mandatory rate (currently ₱200 EE / ₱200 ER default) with optional voluntary additions.
  - **BIR Withholding Tax:** Republic Act No. 10963 (TRAIN Law) graduated tax brackets computed on taxable gross after statutory EE deductions.

### 3.4 Payroll Lifecycle & Immutability
- **States:** `Draft` → `Computed` → `PendingReview` → `UnderReview` → `Approved` → `Finalized`.
- **Locking:** Once marked `Finalized`, a pay period is immutable (read-only; protected against re-computation or deletion).
- **Audit:** All approvals, rejections, and state changes generate immutable `PayrollApprovalLogs`.
- **Variance Engine:** Computes automated period-over-period headcount, gross, OT, and net pay deltas.

### 3.5 Loans, Benefits & 13th-Month Pay
- **Loans:** Tracks government (SSS, Pag-IBIG) and company loans. Amortizations auto-deducted semi-monthly until `remainingBalance == 0`.
- **Benefits:** Non-taxable De Minimis perks vs. taxable fringe benefits catalog.
- **13th-Month Pay (P.D. 851):** `(Total Basic Salary Earned YTD - Unpaid Absences / LWOP) / 12`.
  - Tax-exempt threshold: **₱90,000.00**; excess included in taxable compensation.

---

## 4. Frontend UI/UX Standards

- **Outer Wrapper:** All feature views must use standard `<div className="flex flex-col gap-6 p-4 lg:p-6">`.
- **Containers:** All tabular data and interactive controls must be encapsulated inside shadcn `<Card>`, `<CardHeader>`, and `<CardContent>`.
- **Components:** Strictly use `shadcn/ui` components (`Button`, `Badge`, `Select`, `Dialog`, `Input`, `Label`, `Tabs`). Avoid raw HTML inputs/selects or inline hardcoded color overrides.
- **Data Tables:** Powered by TanStack Table (`DataTable`) with search, pagination, and `filterElement` toolbar slots.

---

## 5. Development & Verification Commands

```powershell
# Backend (from repository root)
cd backend/src/Payroll.Api
dotnet build
dotnet run

# Frontend (from repository root)
cd frontend
npm run dev

# Verification & Quality Checks
npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit   # Type check
npm --prefix frontend run build                                 # Production bundle
dotnet test backend/src/Payroll.Api                             # Backend tests
```

---

## 6. Roadmap & Future Scope

Refer to [ROADMAP.md](file:///G:/projects/payroll/ROADMAP.md) for the complete phase delivery status.
- **Completed (Phases 1–7):** Auth & RBAC, Timekeeping, Payroll Engine, Dynamic Statutory Formulas, Multi-Tier Approvals, Payslips/Banking/Statutory Reports, Loans/Benefits/13th-Month Pay.
- **Upcoming (Phases 8–12):** Year-End Tax Annualization & BIR Form 2316, Final Pay & Separation Engine, Geofenced Time Clock & Night Differential, Employee Self-Service (ESS), Enterprise Scalability & Security Hardening.
