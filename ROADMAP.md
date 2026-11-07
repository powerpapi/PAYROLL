# Payroll System — Architecture & Feature Roadmap

## Tech Stack & Architecture
- **Architectural Pattern:** Vertical Slice Architecture (without CQRS/MediatR overhead)
- **Backend:** .NET 10 Web API (C#, Minimal APIs grouped by feature slice, FluentValidation)
- **Database & ORM:** PostgreSQL 16 + Entity Framework Core 10 (`NUMERIC(18,4)` for all monetary figures)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Table + TanStack Query
- **Dynamic Contributions Engine:** Default seeded **SSS**, **PhilHealth**, and **Pag-IBIG** (plus **Withholding Tax**), backed by a dynamic `ContributionTypes` + effective-dated `ContributionSchedules` & `ContributionBrackets` schema so new government contributions or rate revisions can be added at runtime without code changes.

---

## Completed Phases

### Phase 1: Authentication, RBAC, Employee Management ✅
- [x] User authentication (JWT login, refresh token, password hashing, current user endpoint, change password)
- [x] Role-Based Access Control (`Admin`, `HR`, `PayrollOfficer`, `Manager`, `Employee`) & user-to-employee account linking
- [x] Employee profiles (personal info, job details, compensation structure, bank details, statutory IDs, 1,000-employee bulk generator)
- [x] Department, designation, and employment status management
- [x] Per-employee dynamic **Earnings & Deductions** management directly from Employee Directory

### Phase 2: Attendance, Leave, Overtime ✅
- [x] Time tracking / attendance logs (clock-in/out, shift schedules, tardiness, undertime, absences)
- [x] Leave management (leave types, balances, accrual rules, leave requests & approval workflows)
- [x] Overtime requests, multipliers (regular OT, rest day OT, holiday OT), and approvals

### Phase 3: Payroll Calculation Engine & Dynamic Earnings/Deductions Group ✅
- [x] Pay period configuration (semi-monthly, monthly, weekly)
- [x] Gross pay computation (basic pay, pro-rated salary, attendance deductions, overtime pay, holiday pay)
- [x] Dynamic **Earnings & Deductions Catalog** (`AllowanceTypes` with `Category = Earning | Deduction` and `GroupName` such as `Allowance`, `Bonus & Incentive`, `Loan & Cash Advance`, `Benefit Deduction`, `Other Deduction`)
- [x] Dynamic per-employee **Earnings** (Rice, Transportation, Laundry, Clothing, Meal, Medical, Performance Bonus, Productivity Incentive, or custom) and **Deductions** (Salary/Cash Advance, Company/Coop Loan, HMO Dependent Share, Uniform Deduction, or custom)
- [x] Grouped **Earnings vs. Deductions** payroll calculation & side-by-side itemized ledger breakdown (`Basic Pay`, `Overtime & Holiday`, `Allowance`, `Bonus & Incentive` vs. `Attendance Deduction`, `Government Contribution`, `Withholding Tax`, `Loan & Cash Advance`, `Benefit Deduction`, `Other Deduction`)

### Phase 4: Government Contributions and Tax ✅
- [x] Default seeded statutory contributions (**SSS**, **PhilHealth**, **Pag-IBIG**)
- [x] Editable mathematical formula engine (`ContributionFormulaEvaluator`) & dynamic `ContributionTypes` / effective-dated schedules (allowing Admins to edit formulas like `clamp(salary, floor, ceiling) * (ee_rate / 100)`, edit bracket tables, or add new government contributions at runtime)
- [x] Employer vs. Employee share (plus EC / MPF) breakdown per contribution type
- [x] Dynamic, effective-dated graduated Withholding Tax tables

### Phase 5: Payroll Approval and Finalization ✅
- [x] Multi-step payroll approval lifecycle pipeline (`Draft` → `Computed` → `PendingReview` → `UnderReview` → `Approved` → `Finalized`) with role-based sign-off actions
- [x] Automated Period-Over-Period Variance Engine (Headcount $\Delta$, Gross Pay $\Delta$, Net Pay $\Delta$, Overtime Pay $\Delta$, Tax $\Delta$) comparing current vs preceding cutoff
- [x] Audit Flags & Outlier Scanner (zero/negative net pay, overtime spikes $>35\%$, high attendance deductions, salary shifts $>25\%$)
- [x] Permanent payroll locking (`Finalized`), tamper-proofing calculations from re-computation or deletion
- [x] Immutable Governance Audit Trail (`PayrollApprovalLogs`) tracking actor emails, roles, timestamps, state transitions, and review remarks

### Phase 6: Payslips and Reports ✅
- [x] Official Employee Digital & Printable Payslips (`/api/reports/payslips/{id}`) with company branding, statutory IDs, itemized Earnings vs. Deductions, and one-click PDF printing (`@media print`)
- [x] Master Payroll Register with high-density table and CSV spreadsheet export (`/api/reports/payroll-register/csv`)
- [x] Corporate Bank Batch Disbursement File generator for commercial Philippine banks (BDO, BPI, Metrobank, UnionBank, LandBank) with direct CSV download (`/api/reports/bank-disbursement/csv`)
- [x] Double-Entry Accounting Journal Voucher (`/api/reports/accounting-journal`) with balanced debits & credits verification
- [x] Government Statutory Compliance Remittance Schedules (SSS Form R-3, PhilHealth RF-1, Pag-IBIG MCRF, and BIR Form 1601-C) with CSV downloads (`/api/reports/statutory/csv`)

### Phase 7: Loans, Benefits, and 13th-Month Pay ✅
- [x] Employee loan tracking (SSS Salary & Calamity Loans, Pag-IBIG Multi-Purpose & Housing Loans, Company Emergency Loans, Salary Advances) with automated semi-monthly cutoff installment deductions, remaining balance progress bars, and manual/payroll payment recording
- [x] Custom company benefits catalog (Executive HMO, Gym & Fitness, Optical & Dental, Birthday Gift, Educational Assistance Grant, Group Life Insurance) with tax status flags (`De Minimis / Non-Taxable` vs. `Taxable Fringe Benefit`) and per-employee enrollment management
- [x] 13th-Month Pay Accrual Engine adhering to Philippine Presidential Decree No. 851 & Republic Act No. 10963 (TRAIN Law), computing YTD net basic salary divided by 12, statutory non-taxable ceiling up to ₱90,000, graduated withholding tax on excess, and one-click bank/accounting formatted CSV export (`/api/loans-and-benefits/thirteenth-month/export-csv`)

---

## Upcoming Improvement Roadmap

### Phase 8: Year-End Tax Annualization & BIR Form 2316 Generation 📋
- [ ] **Year-End Tax Annualization Engine:** Recalculate annual tax due across all pay periods in the calendar year against TRAIN Law graduated annual brackets.
- [ ] **Year-End Adjustment Automation:** Automatically compute December cutoff Tax Refund (for over-withheld employees) or Tax Payable deduction (for under-withheld employees).
- [ ] **Official BIR Form 2316 Generator:** Generate official, printable PDF certificates of compensation payment and tax withheld with employer/employee signature fields.
- [ ] **BIR Alphalist Export (Form 1604-C):** Generate BIR-compliant Schedule 7.1 (minimum wage earners) and Schedule 7.2 (regular employees) data files for annual tax clearance filing.

### Phase 9: Final Pay, Separation & Clearance Engine 📋
- [ ] **Final Pay Calculation Engine:** Comprehensive settlement calculation for resigned, terminated, or retired employees:
  - Pro-rated basic salary up to the separation date
  - Pro-rated 13th-month pay
  - Unused leave credit cash conversion (honoring the 10-day tax-exempt de minimis limit for vacation leaves)
  - Severance pay under Labor Code Articles 298/299 (half-month vs full-month per year of service for retrenchment, redundancy, closure, disease)
  - Automatic offsetting of outstanding government and company loan balances
- [ ] **Inter-Department Clearance Workflow:** Clearance checklist across HR, IT, Finance, and Operations with approval gates.
- [ ] **Document Generation:** One-click generation of Certificate of Employment (COE), Quitclaim/Release Waiver, and final BIR 2316.

### Phase 10: Geofenced Time Clock, Shift Rostering & Night Differential Engine 📋
- [ ] **Geofenced Web & Dynamic QR Attendance Kiosk:** Software-based clock-in/out with GPS radius validation and rotating office QR code attendance kiosk—eliminating proprietary biometric hardware while preventing buddy punching.
- [ ] **Universal DTR & Timesheet Import Wizard:** Drag-and-drop CSV/Excel punch log importer with configurable column mapping, duplicate punch deduplication, and missing clock-in/out anomaly resolver.
- [ ] **Shift Rostering & Night Shift Differential (NSD):** 24/7 rotational shift scheduling, cross-midnight graveyard log pairing, and automatic 10% NSD premium calculation for hours worked between 10:00 PM and 6:00 AM.
- [ ] **DOLE Philippine Holiday Pay Engine:** Complete statutory holiday computation matrix (Regular Holiday 200%, Special Non-Working Day 130%, Double Holiday, and Rest Day Overtime combinations).

### Phase 11: Employee Self-Service (ESS) Portal 📋
- [ ] **Employee Portal Dashboard:** Self-service portal where linked employee accounts can view historical digital payslips, tax certificates (2316), and loan balances.
- [ ] **Online Request Filing:** Digital submission for Leave Applications, Overtime Pre-Approvals, and Attendance Time Dispute Adjustments (DTR filing).
- [ ] **Manager Approvals Inbox:** Dashboard inbox for Department Managers and Supervisors to approve or reject pending leave/OT requests with notifications.

### Phase 12: Enterprise Multi-Tenancy & Performance Hardening 📋
- [ ] **Multi-Branch & Multi-Company Support:** Support for corporate groups with distinct legal entities, branches, TINs, RDOs, and SSS/PhilHealth/HDMF employer numbers.
- [ ] **Asynchronous Payroll Processing:** Background job queue (.NET Channels or Hangfire) for computing payroll runs with 5,000+ employees with real-time SSE progress indicators.
- [ ] **Security Hardening:** Field-level encryption for sensitive employee PII (TIN, SSS, PhilHealth, bank account numbers) and 2FA authentication for final payroll authorization.

