namespace Payroll.Api.Data.Entities;

public abstract class AuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

// ============================================================================
// PHASE 1: AUTHENTICATION, RBAC & EMPLOYEE MANAGEMENT
// ============================================================================

public static class UserRoles
{
    public const string Admin = "Admin";
    public const string HR = "HR";
    public const string PayrollOfficer = "PayrollOfficer";
    public const string Manager = "Manager";
    public const string Employee = "Employee";

    public static readonly string[] All = [Admin, HR, PayrollOfficer, Manager, Employee];
}

public class User : AuditableEntity
{
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string Role { get; set; } = UserRoles.Employee;
    public bool IsActive { get; set; } = true;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryUtc { get; set; }
    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }
}

public class RoleFeaturePermission : AuditableEntity
{
    public required string Role { get; set; }
    public required string FeatureKey { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public static class AppFeatures
{
    public const string Dashboard = "dashboard";
    public const string Employees = "employees";
    public const string Departments = "departments";
    public const string UsersRbac = "users";
    public const string Timekeeping = "timekeeping";
    public const string PayrollEngine = "payroll";
    public const string Contributions = "contributions";
    public const string Approvals = "approvals";
    public const string Reports = "reports";
    public const string LoansBenefits = "loans-benefits";

    public record FeatureDefinition(
        string Key,
        string Name,
        string Description,
        string Category,
        string[] DefaultRoles);

    public static readonly FeatureDefinition[] All =
    [
        new(Dashboard, "Dashboard Overview", "Executive high-level KPIs, payroll metrics, headcount variance, and quick actions.", "Core", [UserRoles.Admin, UserRoles.HR, UserRoles.PayrollOfficer, UserRoles.Manager, UserRoles.Employee]),
        new(Employees, "Employee Directory & Compensation", "Manage employee profiles, salaries, dynamic allowances, and bulk generation.", "Human Resources", [UserRoles.Admin, UserRoles.HR, UserRoles.PayrollOfficer, UserRoles.Manager]),
        new(Departments, "Departments & Cost Centers", "Manage company organizational hierarchy, divisions, and cost centers.", "Human Resources", [UserRoles.Admin, UserRoles.HR]),
        new(UsersRbac, "Users & Role Permissions", "Manage system accounts, user status, and customize role-based feature permissions.", "Administration", [UserRoles.Admin, UserRoles.HR]),
        new(Timekeeping, "Attendance, Leave & Overtime", "Daily time tracking, clock-in/out, leave accrual balances, and overtime requests.", "Time & Attendance", [UserRoles.Admin, UserRoles.HR, UserRoles.Manager]),
        new(PayrollEngine, "Payroll Engine & Allowances", "Semi-monthly cutoff calculations, grouped earnings/deductions, and preview runs.", "Payroll Processing", [UserRoles.Admin, UserRoles.PayrollOfficer]),
        new(Contributions, "Government Contributions & Tax", "Statutory brackets (SSS, PhilHealth, Pag-IBIG) and dynamic formula evaluator.", "Statutory & Tax", [UserRoles.Admin, UserRoles.PayrollOfficer]),
        new(Approvals, "Approvals & Finalization Locking", "Multi-stage approval pipeline, variance engine, audit trail, and permanent locking.", "Payroll Processing", [UserRoles.Admin, UserRoles.PayrollOfficer, UserRoles.Manager]),
        new(Reports, "Official Payslips & Reports", "Digital printable payslips, bank disbursement CSVs, and accounting journal voucher.", "Reports & Compliance", [UserRoles.Admin, UserRoles.HR, UserRoles.PayrollOfficer, UserRoles.Manager, UserRoles.Employee]),
        new(LoansBenefits, "Loans, Benefits & 13th-Month Pay", "Government and company loan amortizations, company benefits, and 13th-month accruals.", "Compensation & Benefits", [UserRoles.Admin, UserRoles.HR, UserRoles.PayrollOfficer])
    ];

    public static readonly Dictionary<string, string[]> DefaultRoleFeatures = new(StringComparer.OrdinalIgnoreCase)
    {
        [UserRoles.Admin] = [Dashboard, Employees, Departments, UsersRbac, Timekeeping, PayrollEngine, Contributions, Approvals, Reports, LoansBenefits],
        [UserRoles.HR] = [Dashboard, Employees, Departments, UsersRbac, Timekeeping, Reports, LoansBenefits],
        [UserRoles.PayrollOfficer] = [Dashboard, Employees, PayrollEngine, Contributions, Approvals, Reports, LoansBenefits],
        [UserRoles.Manager] = [Dashboard, Employees, Timekeeping, Approvals, Reports],
        [UserRoles.Employee] = [Dashboard, Reports]
    };

    public static string[] GetDefaultFeaturesForRole(string role)
    {
        return DefaultRoleFeatures.TryGetValue(role, out var features)
            ? features
            : [Dashboard];
    }
}

public class Department : AuditableEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

public class Employee : AuditableEntity
{
    public required string EmployeeCode { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public string? MiddleName { get; set; }
    public required string Email { get; set; }
    public DateOnly HireDate { get; set; }
    public string EmploymentStatus { get; set; } = "Regular"; // Regular, Probationary, Contractual
    public string JobTitle { get; set; } = string.Empty;

    public Guid DepartmentId { get; set; }
    public Department? Department { get; set; }

    // Shift Schedule (Phase 2)
    public TimeOnly ShiftStartTime { get; set; } = new(9, 0);
    public TimeOnly ShiftEndTime { get; set; } = new(18, 0);

    // Compensation
    public string PayFrequency { get; set; } = "SemiMonthly"; // SemiMonthly, Monthly, Weekly
    public decimal BasicMonthlySalary { get; set; } // Stored as NUMERIC(18,4)
    public decimal DailyRate { get; set; }
    public decimal HourlyRate { get; set; }

    // Statutory Numbers
    public string? TinNumber { get; set; }
    public string? SssNumber { get; set; }
    public string? PhilHealthNumber { get; set; }
    public string? PagIbigNumber { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankName { get; set; }

    public bool IsActive { get; set; } = true;
}

// ============================================================================
// PHASE 2: ATTENDANCE, LEAVE & OVERTIME
// ============================================================================

public class AttendanceLog : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public DateOnly WorkDate { get; set; }
    public TimeOnly? ClockIn { get; set; }
    public TimeOnly? ClockOut { get; set; }

    public string Status { get; set; } = "Present";

    public decimal HoursWorked { get; set; }
    public int LateMinutes { get; set; }
    public int UndertimeMinutes { get; set; }
    public string? Remarks { get; set; }
}

public class LeaveType : AuditableEntity
{
    public required string Code { get; set; } // VL, SL, EL, LWOP
    public required string Name { get; set; }
    public decimal DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

public class LeaveBalance : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public Guid LeaveTypeId { get; set; }
    public LeaveType? LeaveType { get; set; }

    public int Year { get; set; }
    public decimal EntitledDays { get; set; }
    public decimal UsedDays { get; set; }
}

public class LeaveRequest : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public Guid LeaveTypeId { get; set; }
    public LeaveType? LeaveType { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public required string Reason { get; set; }

    public string Status { get; set; } = "Pending";
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

public class OvertimeRequest : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public DateOnly WorkDate { get; set; }
    public decimal Hours { get; set; }

    public string OvertimeType { get; set; } = "RegularOT";
    public decimal Multiplier { get; set; } = 1.25m;
    public decimal ComputedAmount { get; set; }
    public required string Reason { get; set; }

    public string Status { get; set; } = "Pending";
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

// ============================================================================
// PHASE 3: PAYROLL CALCULATION ENGINE & DYNAMIC ALLOWANCES
// ============================================================================

/// <summary>
/// Dynamic catalog of reusable Earnings & Deductions component types
/// (e.g. Earnings: Rice, Transportation, Laundry, Performance Bonus; Deductions: Cash Advance, HMO Dependent, Loan).
/// Admins/HR can create new types at runtime and assign them per employee with custom amounts.
/// </summary>
public class AllowanceType : AuditableEntity
{
    public required string Code { get; set; } // e.g. "RICE", "TRANSPO", "BONUS", "CASH_ADV"
    public required string Name { get; set; } // e.g. "Rice Subsidy", "Performance Bonus", "Cash Advance"
    public string Category { get; set; } = "Earning"; // "Earning" or "Deduction"
    public string GroupName { get; set; } = "Allowance"; // e.g. "Allowance", "Bonus & Incentive", "Loan & Cash Advance", "Other Deduction"
    public decimal DefaultAmount { get; set; }
    public bool IsTaxable { get; set; }
    public string DefaultFrequency { get; set; } = "Monthly"; // Monthly or PerCutoff
    public bool IsActive { get; set; } = true;
}

public class EmployeeAllowance : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public Guid? AllowanceTypeId { get; set; }
    public AllowanceType? AllowanceType { get; set; }

    public string Category { get; set; } = "Earning"; // "Earning" or "Deduction"
    public string GroupName { get; set; } = "Allowance"; // Sub-group under Earning or Deduction
    public string Code { get; set; } = "ALW";
    public required string Name { get; set; }
    public decimal Amount { get; set; }
    public bool IsTaxable { get; set; }
    public string Frequency { get; set; } = "Monthly"; // Monthly or PerCutoff
    public bool IsActive { get; set; } = true;
}

public class PayrollPeriod : AuditableEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string PayFrequency { get; set; } = "SemiMonthly";
    public int CutoffSlot { get; set; } = 1;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateOnly PayDate { get; set; }

    public string Status { get; set; } = "Draft"; // Draft, Computed, PendingReview, UnderReview, Approved, Finalized, Rejected
    public DateTime? ComputedAtUtc { get; set; }
    public DateTime? FinalizedAtUtc { get; set; }

    // Phase 5: Multi-Step Approval & Governance Trail
    public DateTime? SubmittedAtUtc { get; set; }
    public Guid? SubmittedByUserId { get; set; }
    public string? SubmittedByEmail { get; set; }

    public DateTime? ReviewStartedAtUtc { get; set; }
    public Guid? ReviewStartedByUserId { get; set; }
    public string? ReviewStartedByEmail { get; set; }

    public DateTime? ApprovedAtUtc { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public string? ApprovedByEmail { get; set; }

    public Guid? FinalizedByUserId { get; set; }
    public string? FinalizedByEmail { get; set; }

    public string? RejectionRemarks { get; set; }

    public ICollection<PayrollItem> Items { get; set; } = new List<PayrollItem>();
    public ICollection<PayrollApprovalLog> ApprovalLogs { get; set; } = new List<PayrollApprovalLog>();
}

/// <summary>
/// Phase 5: Immutable governance audit log of all payroll state changes and sign-offs.
/// </summary>
public class PayrollApprovalLog : AuditableEntity
{
    public Guid PayrollPeriodId { get; set; }
    public PayrollPeriod? PayrollPeriod { get; set; }

    public required string Action { get; set; } // Submit, StartReview, Approve, Reject, Finalize, Recompute
    public required string FromStatus { get; set; }
    public required string ToStatus { get; set; }

    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserRole { get; set; }
    public string? Remarks { get; set; }
}

public class PayrollItem : AuditableEntity
{
    public Guid PayrollPeriodId { get; set; }
    public PayrollPeriod? PayrollPeriod { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public int DaysWorked { get; set; }
    public int AbsentDays { get; set; }
    public int LateUndertimeMinutes { get; set; }
    public decimal OvertimeHours { get; set; }

    // Earnings & Gross Breakdown
    public decimal BasicPay { get; set; }
    public decimal AbsenceDeduction { get; set; }
    public decimal LateUndertimeDeduction { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal HolidayPay { get; set; }
    public decimal TaxableAllowances { get; set; }
    public decimal NonTaxableAllowances { get; set; }
    public decimal GrossPay { get; set; }

    // Statutory Contributions, Deductions & Tax Breakdown
    public decimal TotalEmployeeContributions { get; set; }
    public decimal TotalEmployerContributions { get; set; }
    public decimal TaxableIncome { get; set; }
    public decimal WithholdingTax { get; set; }
    public decimal OtherDeductions { get; set; }

    // Final Net Pay
    public decimal NetPay { get; set; }

    public ICollection<PayrollItemLine> Lines { get; set; } = new List<PayrollItemLine>();
}

public class PayrollItemLine : AuditableEntity
{
    public Guid PayrollItemId { get; set; }
    public PayrollItem? PayrollItem { get; set; }

    public required string LineType { get; set; } // "Earning" or "Deduction"
    public string GroupName { get; set; } = "Basic Pay"; // e.g. "Basic Pay", "Allowance", "Bonus & Incentive", "Attendance Deduction", "Government Contribution", "Withholding Tax", "Other Deduction"
    public required string Code { get; set; }
    public required string Description { get; set; }
    public decimal Amount { get; set; }
    public decimal EmployerAmount { get; set; }
}

// ============================================================================
// PHASE 4: DYNAMIC GOVERNMENT CONTRIBUTIONS & TAX ENGINE
// ============================================================================

public enum ContributionCalculationMode
{
    FixedAmount = 1,
    Percentage = 2,
    BracketTable = 3,
    FormulaExpression = 4
}

public class ContributionType : AuditableEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool IsSystemDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsTaxDeductible { get; set; } = true;

    public ICollection<ContributionSchedule> Schedules { get; set; } = new List<ContributionSchedule>();
}

public class ContributionSchedule : AuditableEntity
{
    public Guid ContributionTypeId { get; set; }
    public ContributionType? ContributionType { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    public ContributionCalculationMode CalculationMode { get; set; }

    public decimal EmployeeRatePercent { get; set; }
    public decimal EmployerRatePercent { get; set; }
    public decimal FixedEmployeeAmount { get; set; }
    public decimal FixedEmployerAmount { get; set; }
    public decimal? SalaryFloor { get; set; }
    public decimal? SalaryCeiling { get; set; }

    public string? EmployeeFormula { get; set; }
    public string? EmployerFormula { get; set; }

    public ICollection<ContributionBracket> Brackets { get; set; } = new List<ContributionBracket>();
}

public class ContributionBracket : AuditableEntity
{
    public Guid ContributionScheduleId { get; set; }
    public ContributionSchedule? ContributionSchedule { get; set; }

    public decimal MinCompensation { get; set; }
    public decimal? MaxCompensation { get; set; }
    public decimal MonthlySalaryCredit { get; set; }
    public decimal EmployeeShare { get; set; }
    public decimal EmployerShare { get; set; }
    public decimal EmployerEcShare { get; set; }
}

/// <summary>
/// Dynamic, effective-dated graduated Withholding Tax bracket table with optional custom formula override.
/// </summary>
public class TaxBracket : AuditableEntity
{
    public required string BracketName { get; set; } // e.g., "Bracket 1 (Exempt)", "Bracket 2 (15%)"
    public DateOnly EffectiveFrom { get; set; } = new(2025, 1, 1);
    public DateOnly? EffectiveTo { get; set; }

    public decimal MinMonthlyIncome { get; set; }
    public decimal? MaxMonthlyIncome { get; set; } // Null = "and above"
    public decimal BaseTax { get; set; }
    public decimal ExcessOverAmount { get; set; }
    public decimal ExcessRatePercent { get; set; }

    /// <summary>
    /// Optional editable formula expression for this tax bracket:
    /// Variables: taxable, min_income, base_tax, excess_over, rate
    /// Default: "base_tax + max(0, taxable - excess_over) * (rate / 100)"
    /// </summary>
    public string? TaxFormula { get; set; }
}

// ============================================================================
// PHASE 7: LOANS, COMPANY BENEFITS & 13TH-MONTH PAY
// ============================================================================

public class EmployeeLoan : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public required string LoanType { get; set; } // e.g. "SssSalaryLoan", "PagIbigMpl", "CompanyLoan", "EmergencyAdvance"
    public required string ReferenceNumber { get; set; }
    public decimal PrincipalAmount { get; set; }
    public decimal TotalAmountDue { get; set; }
    public decimal MonthlyAmortization { get; set; }
    public decimal AmortizationPerCutoff { get; set; }
    public decimal RemainingBalance { get; set; }
    public int TermMonths { get; set; } = 12;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "Active"; // Active, PaidOff, Suspended
    public string? Remarks { get; set; }

    public ICollection<LoanPayment> Payments { get; set; } = new List<LoanPayment>();
}

public class LoanPayment : AuditableEntity
{
    public Guid EmployeeLoanId { get; set; }
    public EmployeeLoan? EmployeeLoan { get; set; }

    public Guid? PayrollPeriodId { get; set; }
    public PayrollPeriod? PayrollPeriod { get; set; }

    public DateOnly PaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "PayrollDeduction"; // PayrollDeduction, DirectPayment
    public string? Remarks { get; set; }
}

public class CompanyBenefit : AuditableEntity
{
    public required string Code { get; set; } // e.g. "HMO_PLUS", "GYM_SUBSIDY", "OPTICAL", "BIRTHDAY_CASH"
    public required string Name { get; set; } // e.g. "Executive Health & Dental", "Gym & Fitness Subsidy"
    public string Category { get; set; } = "Wellness"; // Wellness, Insurance, Allowance, Perk
    public string? Description { get; set; }
    public decimal CoverageAmount { get; set; }
    public bool IsTaxable { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<EmployeeBenefitEnrollment> Enrollments { get; set; } = new List<EmployeeBenefitEnrollment>();
}

public class EmployeeBenefitEnrollment : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public Guid CompanyBenefitId { get; set; }
    public CompanyBenefit? CompanyBenefit { get; set; }

    public DateOnly EnrollmentDate { get; set; }
    public decimal CoverageAmount { get; set; }
    public string Status { get; set; } = "Active"; // Active, Inactive
    public string? Remarks { get; set; }
}

public class ThirteenthMonthRecord : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public int Year { get; set; }
    public decimal TotalBasicSalaryEarned { get; set; }
    public decimal TotalAbsenceDeductions { get; set; }
    public decimal NetBasicSalary { get; set; }
    public decimal ComputedThirteenthMonthPay { get; set; }
    public decimal TaxExemptAmount { get; set; }
    public decimal TaxableAmount { get; set; }
    public DateTime? DisbursedAtUtc { get; set; }
    public string Status { get; set; } = "Draft"; // Draft, Disbursed
}
