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
    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }
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

    // Compensation
    public string PayFrequency { get; set; } = "SemiMonthly"; // SemiMonthly, Monthly, Weekly
    public decimal BasicMonthlySalary { get; set; } // Stored as NUMERIC(18,4)
    public decimal DailyRate { get; set; }
    public decimal HourlyRate { get; set; }

    // Statutory Numbers (Default PH + Extensible JSON/Metadata if needed)
    public string? TinNumber { get; set; }
    public string? SssNumber { get; set; }
    public string? PhilHealthNumber { get; set; }
    public string? PagIbigNumber { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankName { get; set; }

    public bool IsActive { get; set; } = true;
}

// ============================================================================
// PHASE 4: DYNAMIC GOVERNMENT CONTRIBUTIONS & TAX ENGINE
// ============================================================================

public enum ContributionCalculationMode
{
    FixedAmount = 1,    // Flat Employee & Employer amount
    Percentage = 2,     // Rate % with optional salary Floor & Ceiling (e.g., PhilHealth, Pag-IBIG)
    BracketTable = 3    // Salary range lookup table (e.g., SSS)
}

/// <summary>
/// Represents a government contribution type.
/// Default seeded: SSS, PHILHEALTH, PAGIBIG.
/// Admins can dynamically create additional statutory contribution types at runtime.
/// </summary>
public class ContributionType : AuditableEntity
{
    public required string Code { get; set; }        // e.g., "SSS", "PHILHEALTH", "PAGIBIG", or custom
    public required string Name { get; set; }        // e.g., "Social Security System"
    public string? Description { get; set; }
    public bool IsSystemDefault { get; set; }        // True for SSS, PhilHealth, Pag-IBIG
    public bool IsActive { get; set; } = true;
    public bool IsTaxDeductible { get; set; } = true; // Deducted before computing withholding tax

    public ICollection<ContributionSchedule> Schedules { get; set; } = new List<ContributionSchedule>();
}

/// <summary>
/// Effective-dated schedule for a ContributionType so rate/table updates apply dynamically by date
/// without breaking historical payroll calculations.
/// </summary>
public class ContributionSchedule : AuditableEntity
{
    public Guid ContributionTypeId { get; set; }
    public ContributionType? ContributionType { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    public ContributionCalculationMode CalculationMode { get; set; }

    // Used when CalculationMode == FixedAmount or Percentage
    public decimal EmployeeRatePercent { get; set; }
    public decimal EmployerRatePercent { get; set; }
    public decimal FixedEmployeeAmount { get; set; }
    public decimal FixedEmployerAmount { get; set; }
    public decimal? SalaryFloor { get; set; }
    public decimal? SalaryCeiling { get; set; }

    public ICollection<ContributionBracket> Brackets { get; set; } = new List<ContributionBracket>();
}

/// <summary>
/// Used when CalculationMode == BracketTable (e.g. SSS contribution table).
/// </summary>
public class ContributionBracket : AuditableEntity
{
    public Guid ContributionScheduleId { get; set; }
    public ContributionSchedule? ContributionSchedule { get; set; }

    public decimal MinCompensation { get; set; }
    public decimal? MaxCompensation { get; set; } // Null means "and above"
    public decimal MonthlySalaryCredit { get; set; }
    public decimal EmployeeShare { get; set; }
    public decimal EmployerShare { get; set; }
    public decimal EmployerEcShare { get; set; }  // Employees' Compensation (if applicable)
}
