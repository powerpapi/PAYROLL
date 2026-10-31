# Payroll System — Architecture & Feature Roadmap

## Tech Stack & Architecture
- **Architectural Pattern:** Vertical Slice Architecture (without CQRS/MediatR overhead)
- **Backend:** .NET 10 Web API (C#, Minimal APIs grouped by feature slice, FluentValidation)
- **Database & ORM:** PostgreSQL 16 + Entity Framework Core 10 (`NUMERIC(18,4)` for all monetary figures)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- **Dynamic Contributions Engine:** Default seeded **SSS**, **PhilHealth**, and **Pag-IBIG** (plus **Withholding Tax**), backed by a dynamic `ContributionTypes` + effective-dated `ContributionSchedules` & `ContributionBrackets` schema so new government contributions or rate revisions can be added at runtime without code changes.

---

## Feature Phases

### Phase 1: Authentication, RBAC, Employee Management ✅
- [x] User authentication (JWT login, refresh token, password hashing, current user endpoint, change password)
- [x] Role-Based Access Control (`Admin`, `HR`, `PayrollOfficer`, `Manager`, `Employee`) & user-to-employee account linking
- [x] Employee profiles (personal info, job details, compensation structure, bank details, statutory IDs)
- [x] Department, designation, and employment status management

### Phase 2: Attendance, Leave, Overtime
- [ ] Time tracking / attendance logs (clock-in/out, shift schedules, tardiness, undertime, absences)
- [ ] Leave management (leave types, balances, accrual rules, leave requests & approval workflows)
- [ ] Overtime requests, multipliers (regular OT, rest day OT, holiday OT), and approvals

### Phase 3: Payroll Calculation Engine
- [ ] Pay period configuration (semi-monthly, monthly, weekly)
- [ ] Gross pay computation (basic pay, pro-rated salary, attendance deductions, overtime pay, holiday pay)
- [ ] Allowances (taxable and non-taxable/de minimis) and recurring adjustments

### Phase 4: Government Contributions and Tax
- [ ] Default seeded statutory contributions (**SSS**, **PhilHealth**, **Pag-IBIG**)
- [ ] Dynamic `ContributionTypes` & effective-dated schedules/brackets (allowing Admins to add new government contributions or update tables/rates dynamically via `FixedAmount`, `Percentage` with floor/ceiling, or `BracketTable`)
- [ ] Employer vs. Employee share (plus EC / MPF) breakdown per contribution type
- [ ] Dynamic, effective-dated graduated Withholding Tax tables

### Phase 5: Payroll Approval and Finalization
- [ ] Payroll run draft generation & review interface
- [ ] Multi-step payroll verification, variance checking, and approval workflow
- [ ] Payroll locking / finalization & immutable audit trail

### Phase 6: Payslips and Reports
- [ ] Individual employee payslip generation (viewable online & downloadable PDF with dynamic contribution lines)
- [ ] Payroll register, bank disbursement files, and accounting journal summaries
- [ ] Statutory remittance reports (SSS, PhilHealth, Pag-IBIG, and any custom statutory contributions) and tax summary reports

### Phase 7: Loans, Benefits, and 13th-Month Pay
- [ ] Employee loan tracking (government loans & company loans) with automated installment deductions
- [ ] Custom company benefits management
- [ ] 13th-month pay accrual, pro-rating, and year-end payout calculation
