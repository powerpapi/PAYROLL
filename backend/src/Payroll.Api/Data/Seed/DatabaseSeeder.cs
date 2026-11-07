using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Data.Seed;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // Ensure Phase 1–4 gap columns & tables exist seamlessly on existing DB
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE IF EXISTS "Users"
                ADD COLUMN IF NOT EXISTS "RefreshToken" text NULL,
                ADD COLUMN IF NOT EXISTS "RefreshTokenExpiryUtc" timestamp with time zone NULL;

            ALTER TABLE IF EXISTS "Employees"
                ADD COLUMN IF NOT EXISTS "ShiftStartTime" time without time zone NOT NULL DEFAULT '09:00:00',
                ADD COLUMN IF NOT EXISTS "ShiftEndTime" time without time zone NOT NULL DEFAULT '18:00:00';

            ALTER TABLE IF EXISTS "PayrollItems"
                ADD COLUMN IF NOT EXISTS "HolidayPay" numeric(18,4) NOT NULL DEFAULT 0;

            ALTER TABLE IF EXISTS "ContributionSchedules"
                ADD COLUMN IF NOT EXISTS "EmployeeFormula" text NULL,
                ADD COLUMN IF NOT EXISTS "EmployerFormula" text NULL;

            UPDATE "ContributionSchedules"
            SET "EmployeeFormula" = 'clamp(salary, floor, ceiling) * (ee_rate / 100)',
                "EmployerFormula" = 'clamp(salary, floor, ceiling) * (er_rate / 100)'
            WHERE "EmployeeFormula" IS NULL AND "CalculationMode" IN (2, 4);

            CREATE TABLE IF NOT EXISTS "TaxBrackets" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "BracketName" character varying(128) NOT NULL,
                "EffectiveFrom" date NOT NULL,
                "EffectiveTo" date NULL,
                "MinMonthlyIncome" numeric(18,4) NOT NULL,
                "MaxMonthlyIncome" numeric(18,4) NULL,
                "BaseTax" numeric(18,4) NOT NULL,
                "ExcessOverAmount" numeric(18,4) NOT NULL,
                "ExcessRatePercent" numeric(18,4) NOT NULL,
                "TaxFormula" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "LeaveTypes" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Code" character varying(32) NOT NULL UNIQUE,
                "Name" character varying(128) NOT NULL,
                "DefaultDaysPerYear" numeric(18,4) NOT NULL,
                "IsPaid" boolean NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "AttendanceLogs" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "WorkDate" date NOT NULL,
                "ClockIn" time without time zone NULL,
                "ClockOut" time without time zone NULL,
                "Status" character varying(32) NOT NULL,
                "HoursWorked" numeric(18,4) NOT NULL,
                "LateMinutes" integer NOT NULL,
                "UndertimeMinutes" integer NOT NULL,
                "Remarks" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_AttendanceLogs_EmployeeId_WorkDate" UNIQUE ("EmployeeId", "WorkDate")
            );

            CREATE TABLE IF NOT EXISTS "LeaveBalances" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "LeaveTypeId" uuid NOT NULL REFERENCES "LeaveTypes"("Id") ON DELETE CASCADE,
                "Year" integer NOT NULL,
                "EntitledDays" numeric(18,4) NOT NULL,
                "UsedDays" numeric(18,4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_LeaveBalances_EmployeeId_LeaveTypeId_Year" UNIQUE ("EmployeeId", "LeaveTypeId", "Year")
            );

            CREATE TABLE IF NOT EXISTS "LeaveRequests" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "LeaveTypeId" uuid NOT NULL REFERENCES "LeaveTypes"("Id") ON DELETE RESTRICT,
                "StartDate" date NOT NULL,
                "EndDate" date NOT NULL,
                "TotalDays" numeric(18,4) NOT NULL,
                "Reason" text NOT NULL,
                "Status" character varying(32) NOT NULL,
                "ReviewRemarks" text NULL,
                "ReviewedAtUtc" timestamp with time zone NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "OvertimeRequests" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "WorkDate" date NOT NULL,
                "Hours" numeric(18,4) NOT NULL,
                "OvertimeType" character varying(32) NOT NULL,
                "Multiplier" numeric(18,4) NOT NULL,
                "ComputedAmount" numeric(18,4) NOT NULL,
                "Reason" text NOT NULL,
                "Status" character varying(32) NOT NULL,
                "ReviewRemarks" text NULL,
                "ReviewedAtUtc" timestamp with time zone NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "AllowanceTypes" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Code" character varying(32) NOT NULL UNIQUE,
                "Name" character varying(128) NOT NULL,
                "Category" character varying(32) NOT NULL DEFAULT 'Earning',
                "GroupName" character varying(64) NOT NULL DEFAULT 'Allowance',
                "DefaultAmount" numeric(18,4) NOT NULL,
                "IsTaxable" boolean NOT NULL,
                "DefaultFrequency" character varying(32) NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            ALTER TABLE IF EXISTS "AllowanceTypes"
                ADD COLUMN IF NOT EXISTS "Category" character varying(32) NOT NULL DEFAULT 'Earning',
                ADD COLUMN IF NOT EXISTS "GroupName" character varying(64) NOT NULL DEFAULT 'Allowance';

            CREATE TABLE IF NOT EXISTS "EmployeeAllowances" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "AllowanceTypeId" uuid NULL REFERENCES "AllowanceTypes"("Id") ON DELETE SET NULL,
                "Category" character varying(32) NOT NULL DEFAULT 'Earning',
                "GroupName" character varying(64) NOT NULL DEFAULT 'Allowance',
                "Code" character varying(32) NOT NULL DEFAULT 'ALW',
                "Name" character varying(128) NOT NULL,
                "Amount" numeric(18,4) NOT NULL,
                "IsTaxable" boolean NOT NULL,
                "Frequency" character varying(32) NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            ALTER TABLE IF EXISTS "EmployeeAllowances"
                ADD COLUMN IF NOT EXISTS "AllowanceTypeId" uuid NULL REFERENCES "AllowanceTypes"("Id") ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS "Category" character varying(32) NOT NULL DEFAULT 'Earning',
                ADD COLUMN IF NOT EXISTS "GroupName" character varying(64) NOT NULL DEFAULT 'Allowance',
                ADD COLUMN IF NOT EXISTS "Code" character varying(32) NOT NULL DEFAULT 'ALW';

            CREATE TABLE IF NOT EXISTS "PayrollPeriods" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Code" character varying(32) NOT NULL UNIQUE,
                "Name" character varying(128) NOT NULL,
                "PayFrequency" character varying(32) NOT NULL,
                "CutoffSlot" integer NOT NULL,
                "StartDate" date NOT NULL,
                "EndDate" date NOT NULL,
                "PayDate" date NOT NULL,
                "Status" character varying(32) NOT NULL,
                "ComputedAtUtc" timestamp with time zone NULL,
                "FinalizedAtUtc" timestamp with time zone NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "PayrollItems" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "PayrollPeriodId" uuid NOT NULL REFERENCES "PayrollPeriods"("Id") ON DELETE CASCADE,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
                "DaysWorked" integer NOT NULL,
                "AbsentDays" integer NOT NULL,
                "LateUndertimeMinutes" integer NOT NULL,
                "OvertimeHours" numeric(18,4) NOT NULL,
                "BasicPay" numeric(18,4) NOT NULL,
                "AbsenceDeduction" numeric(18,4) NOT NULL,
                "LateUndertimeDeduction" numeric(18,4) NOT NULL,
                "OvertimePay" numeric(18,4) NOT NULL,
                "TaxableAllowances" numeric(18,4) NOT NULL,
                "NonTaxableAllowances" numeric(18,4) NOT NULL,
                "GrossPay" numeric(18,4) NOT NULL,
                "TotalEmployeeContributions" numeric(18,4) NOT NULL,
                "TotalEmployerContributions" numeric(18,4) NOT NULL,
                "TaxableIncome" numeric(18,4) NOT NULL,
                "WithholdingTax" numeric(18,4) NOT NULL,
                "OtherDeductions" numeric(18,4) NOT NULL DEFAULT 0,
                "NetPay" numeric(18,4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_PayrollItems_PayrollPeriodId_EmployeeId" UNIQUE ("PayrollPeriodId", "EmployeeId")
            );

            ALTER TABLE IF EXISTS "PayrollItems"
                ADD COLUMN IF NOT EXISTS "OtherDeductions" numeric(18,4) NOT NULL DEFAULT 0;

            CREATE TABLE IF NOT EXISTS "PayrollItemLines" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "PayrollItemId" uuid NOT NULL REFERENCES "PayrollItems"("Id") ON DELETE CASCADE,
                "LineType" character varying(32) NOT NULL,
                "GroupName" character varying(64) NOT NULL DEFAULT 'Basic Pay',
                "Code" character varying(32) NOT NULL,
                "Description" character varying(256) NOT NULL,
                "Amount" numeric(18,4) NOT NULL,
                "EmployerAmount" numeric(18,4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            ALTER TABLE IF EXISTS "PayrollItemLines"
                ADD COLUMN IF NOT EXISTS "GroupName" character varying(64) NOT NULL DEFAULT 'Basic Pay';

            ALTER TABLE IF EXISTS "PayrollPeriods"
                ADD COLUMN IF NOT EXISTS "SubmittedAtUtc" timestamp with time zone NULL,
                ADD COLUMN IF NOT EXISTS "SubmittedByUserId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "SubmittedByEmail" character varying(256) NULL,
                ADD COLUMN IF NOT EXISTS "ReviewStartedAtUtc" timestamp with time zone NULL,
                ADD COLUMN IF NOT EXISTS "ReviewStartedByUserId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "ReviewStartedByEmail" character varying(256) NULL,
                ADD COLUMN IF NOT EXISTS "ApprovedAtUtc" timestamp with time zone NULL,
                ADD COLUMN IF NOT EXISTS "ApprovedByUserId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "ApprovedByEmail" character varying(256) NULL,
                ADD COLUMN IF NOT EXISTS "FinalizedByUserId" uuid NULL,
                ADD COLUMN IF NOT EXISTS "FinalizedByEmail" character varying(256) NULL,
                ADD COLUMN IF NOT EXISTS "RejectionRemarks" text NULL;

            CREATE TABLE IF NOT EXISTS "PayrollApprovalLogs" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "PayrollPeriodId" uuid NOT NULL REFERENCES "PayrollPeriods"("Id") ON DELETE CASCADE,
                "Action" character varying(64) NOT NULL,
                "FromStatus" character varying(32) NOT NULL,
                "ToStatus" character varying(32) NOT NULL,
                "UserId" uuid NULL,
                "UserEmail" character varying(256) NULL,
                "UserRole" character varying(64) NULL,
                "Remarks" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_PayrollApprovalLogs_PayrollPeriodId" ON "PayrollApprovalLogs" ("PayrollPeriodId");

            CREATE TABLE IF NOT EXISTS "EmployeeLoans" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "LoanType" character varying(64) NOT NULL,
                "ReferenceNumber" character varying(64) NOT NULL,
                "PrincipalAmount" numeric(18,4) NOT NULL,
                "TotalAmountDue" numeric(18,4) NOT NULL,
                "MonthlyAmortization" numeric(18,4) NOT NULL,
                "AmortizationPerCutoff" numeric(18,4) NOT NULL,
                "RemainingBalance" numeric(18,4) NOT NULL,
                "TermMonths" integer NOT NULL,
                "StartDate" date NOT NULL,
                "EndDate" date NOT NULL,
                "Status" character varying(32) NOT NULL,
                "Remarks" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "LoanPayments" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeLoanId" uuid NOT NULL REFERENCES "EmployeeLoans"("Id") ON DELETE CASCADE,
                "PayrollPeriodId" uuid NULL REFERENCES "PayrollPeriods"("Id") ON DELETE SET NULL,
                "PaymentDate" date NOT NULL,
                "Amount" numeric(18,4) NOT NULL,
                "PaymentMethod" character varying(64) NOT NULL,
                "Remarks" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "CompanyBenefits" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Code" character varying(32) NOT NULL UNIQUE,
                "Name" character varying(128) NOT NULL,
                "Category" character varying(64) NOT NULL,
                "Description" text NULL,
                "CoverageAmount" numeric(18,4) NOT NULL,
                "IsTaxable" boolean NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "EmployeeBenefitEnrollments" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "CompanyBenefitId" uuid NOT NULL REFERENCES "CompanyBenefits"("Id") ON DELETE CASCADE,
                "EnrollmentDate" date NOT NULL,
                "CoverageAmount" numeric(18,4) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "Remarks" text NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

            CREATE TABLE IF NOT EXISTS "RoleFeaturePermissions" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Role" character varying(64) NOT NULL,
                "FeatureKey" character varying(64) NOT NULL,
                "IsEnabled" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_RoleFeaturePermissions_Role_FeatureKey" UNIQUE ("Role", "FeatureKey")
            );

            CREATE TABLE IF NOT EXISTS "ThirteenthMonthRecords" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "Year" integer NOT NULL,
                "TotalBasicSalaryEarned" numeric(18,4) NOT NULL,
                "TotalAbsenceDeductions" numeric(18,4) NOT NULL,
                "NetBasicSalary" numeric(18,4) NOT NULL,
                "ComputedThirteenthMonthPay" numeric(18,4) NOT NULL,
                "TaxExemptAmount" numeric(18,4) NOT NULL,
                "TaxableAmount" numeric(18,4) NOT NULL,
                "DisbursedAtUtc" timestamp with time zone NULL,
                "Status" character varying(32) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_ThirteenthMonthRecords_EmployeeId_Year" UNIQUE ("EmployeeId", "Year")
            );
            """);

        // 1. Seed Default Admin User
        if (!await db.Users.AnyAsync())
        {
            db.Users.Add(new User
            {
                Email = "admin@payroll.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                Role = UserRoles.Admin,
                IsActive = true
            });
        }

        // 1.1 Seed Default Role Feature Permissions
        if (!await db.RoleFeaturePermissions.AnyAsync())
        {
            var permissionsToSeed = new List<RoleFeaturePermission>();
            var now = DateTime.UtcNow;

            foreach (var role in UserRoles.All)
            {
                var defaultFeatures = AppFeatures.GetDefaultFeaturesForRole(role).ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (var feature in AppFeatures.All)
                {
                    permissionsToSeed.Add(new RoleFeaturePermission
                    {
                        Role = role,
                        FeatureKey = feature.Key,
                        IsEnabled = defaultFeatures.Contains(feature.Key),
                        CreatedAtUtc = now
                    });
                }
            }

            db.RoleFeaturePermissions.AddRange(permissionsToSeed);
            await db.SaveChangesAsync();
        }

        // 2. Seed Default Departments & 1,000 Employees
        if (!await db.Departments.AnyAsync())
        {
            var eng = new Department { Code = "ENG", Name = "Engineering" };
            var hr = new Department { Code = "HR", Name = "Human Resources" };
            var fin = new Department { Code = "FIN", Name = "Finance & Accounting" };
            var ops = new Department { Code = "OPS", Name = "Operations" };
            var sls = new Department { Code = "SLS", Name = "Sales & Marketing" };

            db.Departments.AddRange(eng, hr, fin, ops, sls);
            await db.SaveChangesAsync();
        }

        var currentEmployeeCount = await db.Employees.CountAsync();
        if (currentEmployeeCount < 1000)
        {
            var departments = await db.Departments.ToListAsync();
            var existingCodes = (await db.Employees.Select(e => e.EmployeeCode).ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var existingEmails = (await db.Employees.Select(e => e.Email).ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            string[] firstNames =
            [
                "Juan", "Maria", "Jose", "Ana", "Carlo", "Bea", "Miguel", "Sofia", "Gabriel", "Camille",
                "Rafael", "Patricia", "Daniel", "Angela", "Paolo", "Katrina", "Mark", "Jasmine", "Christian", "Clarisse",
                "Adrian", "Bianca", "Joshua", "Denise", "Kevin", "Alyssa", "Patrick", "Hannah", "Jerome", "Mikaela"
            ];

            string[] lastNames =
            [
                "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Torres", "Flores", "Rivera", "Gomez", "Bautista",
                "Villanueva", "Ramos", "Castro", "Aquino", "Navarro", "Salazar", "Mercado", "Pascual", "Domingo", "Soriano",
                "Lim", "Tan", "Chua", "Sy", "Ong", "De Guzman", "Morales", "Tolentino", "Valdez", "Aguilar"
            ];

            string[] jobTitles =
            [
                "Software Engineer", "Senior Software Engineer", "QA Analyst", "DevOps Engineer", "Product Manager",
                "HR Specialist", "Payroll Analyst", "Accountant", "Financial Analyst", "Operations Coordinator",
                "Customer Success Associate", "Sales Executive", "Data Analyst", "Systems Administrator", "UI/UX Designer"
            ];

            string[] employmentStatuses = ["Regular", "Regular", "Regular", "Probationary", "Contractual"];
            string[] banks = ["BDO", "BPI", "Metrobank", "UnionBank", "LandBank"];

            var rng = new Random(20261031);
            var bulkEmployees = new List<Employee>(1000);

            for (int i = 1; i <= 1000; i++)
            {
                var code = $"EMP-{i:D4}";
                if (existingCodes.Contains(code))
                    continue;

                var fn = firstNames[(i - 1) % firstNames.Length];
                var ln = lastNames[((i - 1) / firstNames.Length + i) % lastNames.Length];
                var emailSlug = $"{fn.ToLowerInvariant()}.{ln.ToLowerInvariant().Replace(" ", "")}.{i}@payroll.local";

                if (existingEmails.Contains(emailSlug))
                    continue;

                var dept = departments[i % departments.Count];
                var monthlySalary = 18000m + (rng.Next(0, 155) * 500m);
                var dailyRate = Math.Round(monthlySalary * 12m / 261m, 4);
                var hourlyRate = Math.Round(dailyRate / 8m, 4);

                bulkEmployees.Add(new Employee
                {
                    EmployeeCode = code,
                    FirstName = fn,
                    LastName = ln,
                    Email = emailSlug,
                    HireDate = new DateOnly(2020 + (i % 6), 1 + (i % 12), 1 + (i % 27)),
                    EmploymentStatus = employmentStatuses[i % employmentStatuses.Length],
                    JobTitle = jobTitles[i % jobTitles.Length],
                    DepartmentId = dept.Id,
                    ShiftStartTime = new TimeOnly(9, 0),
                    ShiftEndTime = new TimeOnly(18, 0),
                    PayFrequency = "SemiMonthly",
                    BasicMonthlySalary = monthlySalary,
                    DailyRate = dailyRate,
                    HourlyRate = hourlyRate,
                    TinNumber = $"{100 + (i % 899):D3}-{200 + (i % 799):D3}-{300 + (i % 699):D3}-000",
                    SssNumber = $"34-{1000000 + i:D7}-{i % 9}",
                    PhilHealthNumber = $"12-{200000000 + i:D9}-{i % 9}",
                    PagIbigNumber = $"1210-{3000 + (i % 6999):D4}-{4000 + i:D4}",
                    BankName = banks[i % banks.Length],
                    BankAccountNumber = $"00{1000000000L + i}",
                    IsActive = true
                });
            }

            if (bulkEmployees.Count > 0)
            {
                await db.Employees.AddRangeAsync(bulkEmployees);
                await db.SaveChangesAsync();
            }
        }

        // 3. Seed Phase 2 Leave Types, Balances & Sample Timekeeping Records
        if (!await db.LeaveTypes.AnyAsync())
        {
            var vl = new LeaveType { Code = "VL", Name = "Vacation Leave", DefaultDaysPerYear = 15m, IsPaid = true };
            var sl = new LeaveType { Code = "SL", Name = "Sick Leave", DefaultDaysPerYear = 15m, IsPaid = true };
            var el = new LeaveType { Code = "EL", Name = "Emergency Leave", DefaultDaysPerYear = 5m, IsPaid = true };
            var lwop = new LeaveType { Code = "LWOP", Name = "Leave Without Pay", DefaultDaysPerYear = 0m, IsPaid = false };

            db.LeaveTypes.AddRange(vl, sl, el, lwop);
            await db.SaveChangesAsync();

            var employees = await db.Employees.OrderBy(e => e.EmployeeCode).Take(25).ToListAsync();
            var currentYear = DateTime.UtcNow.Year;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            foreach (var emp in employees)
            {
                db.LeaveBalances.AddRange(
                    new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = vl.Id, Year = currentYear, EntitledDays = 15m, UsedDays = 1m },
                    new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = sl.Id, Year = currentYear, EntitledDays = 15m, UsedDays = 0m },
                    new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = el.Id, Year = currentYear, EntitledDays = 5m, UsedDays = 0m }
                );

                db.AttendanceLogs.Add(new AttendanceLog
                {
                    EmployeeId = emp.Id,
                    WorkDate = today,
                    ClockIn = new TimeOnly(8, 55),
                    ClockOut = new TimeOnly(18, 0),
                    Status = "Present",
                    HoursWorked = 8.0m,
                    LateMinutes = 0,
                    UndertimeMinutes = 0,
                    Remarks = "Regular shift"
                });
            }

            var firstEmp = employees.FirstOrDefault();
            if (firstEmp is not null)
            {
                db.LeaveRequests.Add(new LeaveRequest
                {
                    EmployeeId = firstEmp.Id,
                    LeaveTypeId = vl.Id,
                    StartDate = today.AddDays(3),
                    EndDate = today.AddDays(4),
                    TotalDays = 2m,
                    Reason = "Family trip out of town",
                    Status = "Pending"
                });

                db.OvertimeRequests.Add(new OvertimeRequest
                {
                    EmployeeId = firstEmp.Id,
                    WorkDate = today.AddDays(-1),
                    Hours = 3m,
                    OvertimeType = "RegularOT",
                    Multiplier = 1.25m,
                    ComputedAmount = Math.Round(firstEmp.HourlyRate * 3m * 1.25m, 2),
                    Reason = "Month-end closing preparation",
                    Status = "Approved",
                    ReviewedAtUtc = DateTime.UtcNow
                });
            }
        }

        // 4. Seed Phase 3 Dynamic Earnings & Deductions Catalog, Sample Employee Items & Initial Payroll Period
        var defaultComponentTypes = new[]
        {
            // EARNINGS GROUP: Allowances
            new AllowanceType { Code = "RICE", Name = "Rice Subsidy", Category = "Earning", GroupName = "Allowance", DefaultAmount = 2000m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "TRANSPO", Name = "Transportation Allowance", Category = "Earning", GroupName = "Allowance", DefaultAmount = 1500m, IsTaxable = true, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "LAUNDRY", Name = "Laundry Allowance", Category = "Earning", GroupName = "Allowance", DefaultAmount = 300m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "CLOTHING", Name = "Uniform & Clothing Allowance", Category = "Earning", GroupName = "Allowance", DefaultAmount = 500m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "MEAL", Name = "Meal Allowance", Category = "Earning", GroupName = "Allowance", DefaultAmount = 1200m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "MEDICAL", Name = "Medical Cash Allowance", Category = "Earning", GroupName = "Allowance", DefaultAmount = 800m, IsTaxable = false, DefaultFrequency = "Monthly" },

            // EARNINGS GROUP: Bonuses & Incentives
            new AllowanceType { Code = "BONUS", Name = "Performance Bonus", Category = "Earning", GroupName = "Bonus & Incentive", DefaultAmount = 3000m, IsTaxable = true, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "INCENTIVE", Name = "Productivity Incentive", Category = "Earning", GroupName = "Bonus & Incentive", DefaultAmount = 1500m, IsTaxable = true, DefaultFrequency = "Monthly" },

            // DEDUCTIONS GROUP: Loans, Benefits & Other Deductions
            new AllowanceType { Code = "CASH_ADV", Name = "Salary / Cash Advance", Category = "Deduction", GroupName = "Loan & Cash Advance", DefaultAmount = 1000m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "COOP_LOAN", Name = "Company / Coop Loan", Category = "Deduction", GroupName = "Loan & Cash Advance", DefaultAmount = 1500m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "HMO_DEP", Name = "HMO Dependent Share", Category = "Deduction", GroupName = "Benefit Deduction", DefaultAmount = 850m, IsTaxable = false, DefaultFrequency = "Monthly" },
            new AllowanceType { Code = "UNIFORM_DED", Name = "Uniform / ID Deduction", Category = "Deduction", GroupName = "Other Deduction", DefaultAmount = 250m, IsTaxable = false, DefaultFrequency = "Monthly" }
        };

        var existingTypeCodes = (await db.AllowanceTypes.Select(t => t.Code).ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var newTypesToSeed = defaultComponentTypes
            .Where(t => !existingTypeCodes.Contains(t.Code))
            .ToList();

        if (newTypesToSeed.Count > 0)
        {
            db.AllowanceTypes.AddRange(newTypesToSeed);
            await db.SaveChangesAsync();
        }

        // Seed random allowances & deductions for all employees who do not have any yet
        await SeedRandomAllowancesForAllEmployeesAsync(db, overwriteExisting: false);

        if (!await db.PayrollPeriods.AnyAsync())
        {
            var now = DateTime.UtcNow;
            var startOfHalf = new DateOnly(now.Year, now.Month, 16);
            var endOfHalf = new DateOnly(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month));

            db.PayrollPeriods.Add(new PayrollPeriod
            {
                Code = $"{now:yyyy-MM}-B",
                Name = $"{startOfHalf:MMM dd} – {endOfHalf:MMM dd, yyyy} (2nd Cutoff)",
                PayFrequency = "SemiMonthly",
                CutoffSlot = 2,
                StartDate = startOfHalf,
                EndDate = endOfHalf,
                PayDate = endOfHalf,
                Status = "Draft"
            });
        }

        // 5. Seed Default Government Contributions (SSS, PhilHealth, Pag-IBIG)
        if (!await db.ContributionTypes.AnyAsync())
        {
            var effectiveDate = new DateOnly(2025, 1, 1);

            var philHealth = new ContributionType
            {
                Code = "PHILHEALTH",
                Name = "PhilHealth",
                Description = "Philippine Health Insurance Corporation",
                IsSystemDefault = true,
                IsTaxDeductible = true,
                Schedules =
                [
                    new ContributionSchedule
                    {
                        EffectiveFrom = effectiveDate,
                        CalculationMode = ContributionCalculationMode.FormulaExpression,
                        EmployeeRatePercent = 2.5m,
                        EmployerRatePercent = 2.5m,
                        SalaryFloor = 10_000m,
                        SalaryCeiling = 100_000m,
                        EmployeeFormula = "clamp(salary, floor, ceiling) * (ee_rate / 100)",
                        EmployerFormula = "clamp(salary, floor, ceiling) * (er_rate / 100)"
                    }
                ]
            };

            var pagIbig = new ContributionType
            {
                Code = "PAGIBIG",
                Name = "Pag-IBIG (HDMF)",
                Description = "Home Development Mutual Fund",
                IsSystemDefault = true,
                IsTaxDeductible = true,
                Schedules =
                [
                    new ContributionSchedule
                    {
                        EffectiveFrom = effectiveDate,
                        CalculationMode = ContributionCalculationMode.FormulaExpression,
                        EmployeeRatePercent = 2.0m,
                        EmployerRatePercent = 2.0m,
                        SalaryFloor = 1_500m,
                        SalaryCeiling = 10_000m,
                        EmployeeFormula = "min(salary, ceiling) * (ee_rate / 100)",
                        EmployerFormula = "min(salary, ceiling) * (er_rate / 100)"
                    }
                ]
            };

            var sss = new ContributionType
            {
                Code = "SSS",
                Name = "Social Security System",
                Description = "SSS Statutory Contribution",
                IsSystemDefault = true,
                IsTaxDeductible = true,
                Schedules =
                [
                    new ContributionSchedule
                    {
                        EffectiveFrom = effectiveDate,
                        CalculationMode = ContributionCalculationMode.BracketTable,
                        Brackets =
                        [
                            new ContributionBracket { MinCompensation = 0m, MaxCompensation = 5249.99m, MonthlySalaryCredit = 5000m, EmployeeShare = 250m, EmployerShare = 500m, EmployerEcShare = 10m },
                            new ContributionBracket { MinCompensation = 5250m, MaxCompensation = 19749.99m, MonthlySalaryCredit = 15000m, EmployeeShare = 750m, EmployerShare = 1500m, EmployerEcShare = 30m },
                            new ContributionBracket { MinCompensation = 19750m, MaxCompensation = 29749.99m, MonthlySalaryCredit = 25000m, EmployeeShare = 1250m, EmployerShare = 2500m, EmployerEcShare = 30m },
                            new ContributionBracket { MinCompensation = 29750m, MaxCompensation = null, MonthlySalaryCredit = 35000m, EmployeeShare = 1750m, EmployerShare = 3500m, EmployerEcShare = 30m }
                        ]
                    }
                ]
            };

            db.ContributionTypes.AddRange(sss, philHealth, pagIbig);
        }

        // 6. Seed Default Graduated Withholding Tax Brackets (Editable & Formula-Capable)
        if (!await db.TaxBrackets.AnyAsync())
        {
            var eff = new DateOnly(2025, 1, 1);
            var defaultFormula = "base_tax + max(0, taxable - excess_over) * (rate / 100)";

            db.TaxBrackets.AddRange(
                new TaxBracket
                {
                    BracketName = "Bracket 1 — Tax Exempt",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 0m,
                    MaxMonthlyIncome = 20_833m,
                    BaseTax = 0m,
                    ExcessOverAmount = 0m,
                    ExcessRatePercent = 0m,
                    TaxFormula = "0"
                },
                new TaxBracket
                {
                    BracketName = "Bracket 2 — 15% Over 20,833",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 20_833.01m,
                    MaxMonthlyIncome = 33_332.99m,
                    BaseTax = 0m,
                    ExcessOverAmount = 20_833m,
                    ExcessRatePercent = 15m,
                    TaxFormula = defaultFormula
                },
                new TaxBracket
                {
                    BracketName = "Bracket 3 — 20% Over 33,333",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 33_333m,
                    MaxMonthlyIncome = 66_666.99m,
                    BaseTax = 1_875m,
                    ExcessOverAmount = 33_333m,
                    ExcessRatePercent = 20m,
                    TaxFormula = defaultFormula
                },
                new TaxBracket
                {
                    BracketName = "Bracket 4 — 25% Over 66,667",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 66_667m,
                    MaxMonthlyIncome = 166_666.99m,
                    BaseTax = 8_541.80m,
                    ExcessOverAmount = 66_667m,
                    ExcessRatePercent = 25m,
                    TaxFormula = defaultFormula
                },
                new TaxBracket
                {
                    BracketName = "Bracket 5 — 30% Over 166,667",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 166_667m,
                    MaxMonthlyIncome = 666_666.99m,
                    BaseTax = 33_541.80m,
                    ExcessOverAmount = 166_667m,
                    ExcessRatePercent = 30m,
                    TaxFormula = defaultFormula
                },
                new TaxBracket
                {
                    BracketName = "Bracket 6 — 35% Over 666,667",
                    EffectiveFrom = eff,
                    MinMonthlyIncome = 666_667m,
                    MaxMonthlyIncome = null,
                    BaseTax = 183_541.80m,
                    ExcessOverAmount = 666_667m,
                    ExcessRatePercent = 35m,
                    TaxFormula = defaultFormula
                }
            );
        }

        // 7. Seed Default Phase 7 Company Benefits Catalog & Sample Employee Loans
        if (!await db.CompanyBenefits.AnyAsync())
        {
            db.CompanyBenefits.AddRange(
                new CompanyBenefit
                {
                    Code = "HMO_EXEC",
                    Name = "Executive Medical, Dental & Optical Plan",
                    Category = "Health & Wellness",
                    Description = "Comprehensive hospitalization, dental, and outpatient HMO coverage for employees and qualified dependents.",
                    CoverageAmount = 250_000m,
                    IsTaxable = false,
                    IsActive = true
                },
                new CompanyBenefit
                {
                    Code = "GYM_FIT",
                    Name = "Gym Membership & Fitness Subsidy",
                    Category = "Health & Wellness",
                    Description = "Monthly fitness and health wellness subsidy for accredited fitness centers and wellness apps.",
                    CoverageAmount = 15_000m,
                    IsTaxable = false,
                    IsActive = true
                },
                new CompanyBenefit
                {
                    Code = "OPTICAL_BEN",
                    Name = "Annual Optical & Eyewear Allowance",
                    Category = "Perk",
                    Description = "Annual reimbursement allowance for prescription eyeglasses, contacts, and eye examinations.",
                    CoverageAmount = 5_000m,
                    IsTaxable = false,
                    IsActive = true
                },
                new CompanyBenefit
                {
                    Code = "BIRTHDAY_GIFT",
                    Name = "Birthday Cash Token",
                    Category = "Perk",
                    Description = "Special company birthday cash token awarded during the employee's birthday month.",
                    CoverageAmount = 2_000m,
                    IsTaxable = false,
                    IsActive = true
                },
                new CompanyBenefit
                {
                    Code = "EDU_GRANT",
                    Name = "Continuing Education & Certification Grant",
                    Category = "Perk",
                    Description = "Financial assistance for professional seminars, certifications, and graduate course subsidies.",
                    CoverageAmount = 50_000m,
                    IsTaxable = false,
                    IsActive = true
                },
                new CompanyBenefit
                {
                    Code = "LIFE_INS",
                    Name = "Group Term Life & Accident Insurance",
                    Category = "Insurance",
                    Description = "24/7 worldwide group life, disability, and personal accident insurance coverage.",
                    CoverageAmount = 1_000_000m,
                    IsTaxable = false,
                    IsActive = true
                }
            );
        }

        if (!await db.EmployeeLoans.AnyAsync())
        {
            var firstThreeEmployees = await db.Employees.OrderBy(e => e.EmployeeCode).Take(3).ToListAsync();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            if (firstThreeEmployees.Count > 0)
            {
                // Employee 1: SSS Salary Loan
                db.EmployeeLoans.Add(new EmployeeLoan
                {
                    EmployeeId = firstThreeEmployees[0].Id,
                    LoanType = "SSS Salary Loan",
                    ReferenceNumber = "SSS-SL-2026-0081",
                    PrincipalAmount = 30_000m,
                    TotalAmountDue = 32_400m,
                    MonthlyAmortization = 1_350m,
                    AmortizationPerCutoff = 675m,
                    RemainingBalance = 24_300m,
                    TermMonths = 24,
                    StartDate = today.AddMonths(-6),
                    EndDate = today.AddMonths(18),
                    Status = "Active",
                    Remarks = "SSS 2-year salary loan approval."
                });
            }

            if (firstThreeEmployees.Count > 1)
            {
                // Employee 2: Pag-IBIG Multi-Purpose Loan
                db.EmployeeLoans.Add(new EmployeeLoan
                {
                    EmployeeId = firstThreeEmployees[1].Id,
                    LoanType = "Pag-IBIG MPL",
                    ReferenceNumber = "HDMF-MPL-2026-9912",
                    PrincipalAmount = 25_000m,
                    TotalAmountDue = 27_000m,
                    MonthlyAmortization = 1_125m,
                    AmortizationPerCutoff = 562.50m,
                    RemainingBalance = 21_375m,
                    TermMonths = 24,
                    StartDate = today.AddMonths(-5),
                    EndDate = today.AddMonths(19),
                    Status = "Active",
                    Remarks = "Pag-IBIG Multi-Purpose Loan (MPL)."
                });
            }

            if (firstThreeEmployees.Count > 2)
            {
                // Employee 3: Company Emergency Loan
                db.EmployeeLoans.Add(new EmployeeLoan
                {
                    EmployeeId = firstThreeEmployees[2].Id,
                    LoanType = "Company Emergency Loan",
                    ReferenceNumber = "COMP-EMG-2026-042",
                    PrincipalAmount = 12_000m,
                    TotalAmountDue = 12_000m,
                    MonthlyAmortization = 2_000m,
                    AmortizationPerCutoff = 1_000m,
                    RemainingBalance = 8_000m,
                    TermMonths = 6,
                    StartDate = today.AddMonths(-2),
                    EndDate = today.AddMonths(4),
                    Status = "Active",
                    Remarks = "Company emergency loan approved by HR."
                });
            }
        }

        await db.SaveChangesAsync();
    }

    public static async Task<(int EmployeesSeeded, int ItemsCreated)> SeedRandomAllowancesForAllEmployeesAsync(
        AppDbContext db,
        bool overwriteExisting = false)
    {
        var allEmployees = await db.Employees
            .AsNoTracking()
            .OrderBy(e => e.EmployeeCode)
            .Select(e => new { e.Id, e.EmployeeCode })
            .ToListAsync();

        if (allEmployees.Count == 0)
            return (0, 0);

        if (overwriteExisting)
        {
            await db.EmployeeAllowances.ExecuteDeleteAsync();
        }

        var existingEmpIds = overwriteExisting
            ? new HashSet<Guid>()
            : (await db.EmployeeAllowances
                .AsNoTracking()
                .Select(a => a.EmployeeId)
                .Distinct()
                .ToListAsync())
                .ToHashSet();

        var targetEmployees = allEmployees
            .Where(e => !existingEmpIds.Contains(e.Id))
            .ToList();

        if (targetEmployees.Count == 0)
            return (0, 0);

        var catalog = await db.AllowanceTypes
            .AsNoTracking()
            .Where(t => t.IsActive)
            .ToListAsync();

        var earningCatalog = catalog.Where(t => t.Category != "Deduction").ToList();
        var deductionCatalog = catalog.Where(t => t.Category == "Deduction").ToList();

        if (earningCatalog.Count == 0)
            return (0, 0);

        var rng = new Random();
        var toInsert = new List<EmployeeAllowance>(targetEmployees.Count * 3);

        foreach (var emp in targetEmployees)
        {
            // Pick 2 to 4 random distinct Earning allowances/bonuses per employee
            var earningCount = rng.Next(2, Math.Min(5, earningCatalog.Count + 1));
            var chosenEarnings = earningCatalog
                .OrderBy(_ => rng.Next())
                .Take(earningCount)
                .ToList();

            foreach (var eType in chosenEarnings)
            {
                // Vary the amount randomly around DefaultAmount (+/- 30% in 100-peso increments)
                var baseAmt = eType.DefaultAmount > 0 ? eType.DefaultAmount : 1000m;
                var minSteps = Math.Max(2, (int)Math.Round(baseAmt * 0.7m / 100m));
                var maxSteps = Math.Max(minSteps + 2, (int)Math.Round(baseAmt * 1.4m / 100m));
                var randomAmt = rng.Next(minSteps, maxSteps + 1) * 100m;

                toInsert.Add(new EmployeeAllowance
                {
                    EmployeeId = emp.Id,
                    AllowanceTypeId = eType.Id,
                    Category = "Earning",
                    GroupName = string.IsNullOrWhiteSpace(eType.GroupName) ? "Allowance" : eType.GroupName,
                    Code = eType.Code,
                    Name = eType.Name,
                    Amount = randomAmt,
                    IsTaxable = eType.IsTaxable,
                    Frequency = eType.DefaultFrequency is "PerCutoff" ? "PerCutoff" : "Monthly",
                    IsActive = true
                });
            }

            // 65% of employees also get 1 or 2 random Deduction items (HMO, Cash Advance, Loan, Uniform)
            if (deductionCatalog.Count > 0 && rng.NextDouble() < 0.65)
            {
                var dedCount = rng.Next(1, Math.Min(3, deductionCatalog.Count + 1));
                var chosenDeductions = deductionCatalog
                    .OrderBy(_ => rng.Next())
                    .Take(dedCount)
                    .ToList();

                foreach (var dType in chosenDeductions)
                {
                    var baseAmt = dType.DefaultAmount > 0 ? dType.DefaultAmount : 500m;
                    var minSteps = Math.Max(2, (int)Math.Round(baseAmt * 0.6m / 50m));
                    var maxSteps = Math.Max(minSteps + 2, (int)Math.Round(baseAmt * 1.5m / 50m));
                    var randomAmt = rng.Next(minSteps, maxSteps + 1) * 50m;

                    toInsert.Add(new EmployeeAllowance
                    {
                        EmployeeId = emp.Id,
                        AllowanceTypeId = dType.Id,
                        Category = "Deduction",
                        GroupName = string.IsNullOrWhiteSpace(dType.GroupName) ? "Other Deduction" : dType.GroupName,
                        Code = dType.Code,
                        Name = dType.Name,
                        Amount = randomAmt,
                        IsTaxable = false,
                        Frequency = "Monthly",
                        IsActive = true
                    });
                }
            }
        }

        if (toInsert.Count > 0)
        {
            await db.EmployeeAllowances.AddRangeAsync(toInsert);
            await db.SaveChangesAsync();
        }

        return (targetEmployees.Count, toInsert.Count);
    }

    public static async Task<(int EmployeesCount, int AttendanceCount, int LeavesCount, int OvertimeCount)> ResetToThirtyRegularEmployeesAsync(AppDbContext db)
    {
        // 1. Delete all transactional tables and wipe employees
        await db.Database.ExecuteSqlRawAsync("""
            DELETE FROM "PayrollApprovalLogs";
            DELETE FROM "PayrollItemLines";
            DELETE FROM "PayrollItems";
            DELETE FROM "LoanPayments";
            DELETE FROM "EmployeeLoans";
            DELETE FROM "EmployeeBenefitEnrollments";
            DELETE FROM "ThirteenthMonthRecords";
            DELETE FROM "EmployeeAllowances";
            DELETE FROM "AttendanceLogs";
            DELETE FROM "OvertimeRequests";
            DELETE FROM "LeaveRequests";
            DELETE FROM "LeaveBalances";
            UPDATE "Users" SET "EmployeeId" = NULL;
            DELETE FROM "Employees";
        """);

        // 2. Ensure Departments exist
        var deptDefinitions = new[]
        {
            ("ENG", "Engineering"),
            ("HR", "Human Resources"),
            ("FIN", "Finance & Accounting"),
            ("OPS", "Operations"),
            ("SLS", "Sales & Marketing"),
            ("CS", "Customer Support")
        };

        var depts = await db.Departments.ToListAsync();
        foreach (var (code, name) in deptDefinitions)
        {
            if (!depts.Any(d => d.Code == code))
            {
                var newDept = new Department { Code = code, Name = name };
                db.Departments.Add(newDept);
                depts.Add(newDept);
            }
        }
        await db.SaveChangesAsync();
        var deptMap = depts.ToDictionary(d => d.Code, d => d.Id);

        // 3. Create 30 Realistic Philippine Regular Employees
        var seedList = new (string Code, string First, string Last, string Title, string DeptCode, decimal Salary, string Bank, string Account)[]
        {
            ("EMP-0001", "Juan", "Dela Cruz", "Senior Software Engineer", "ENG", 65000m, "BDO", "001234567890"),
            ("EMP-0002", "Maria", "Santos", "Lead QA Automation Engineer", "ENG", 52000m, "BPI", "002345678901"),
            ("EMP-0003", "Jose", "Reyes", "DevOps & Cloud Specialist", "ENG", 58000m, "Metrobank", "003456789012"),
            ("EMP-0004", "Ana", "Garcia", "Full Stack Developer", "ENG", 45000m, "UnionBank", "004567890123"),
            ("EMP-0005", "Carlo", "Mendoza", "UI/UX Product Designer", "ENG", 42000m, "LandBank", "005678901234"),
            ("EMP-0006", "Bea", "Torres", "HR Business Partner", "HR", 48000m, "BDO", "006789012345"),
            ("EMP-0007", "Miguel", "Flores", "Senior Payroll Specialist", "HR", 38000m, "BPI", "007890123456"),
            ("EMP-0008", "Sofia", "Rivera", "Talent Acquisition Associate", "HR", 32000m, "Metrobank", "008901234567"),
            ("EMP-0009", "Gabriel", "Gomez", "Finance & Accounting Manager", "FIN", 75000m, "BDO", "009012345678"),
            ("EMP-0010", "Camille", "Bautista", "Senior Corporate Accountant", "FIN", 46000m, "BPI", "010123456789"),
            ("EMP-0011", "Rafael", "Villanueva", "Accounts Payable Analyst", "FIN", 34000m, "UnionBank", "011234567890"),
            ("EMP-0012", "Patricia", "Ramos", "Operations Director", "OPS", 68000m, "BDO", "012345678901"),
            ("EMP-0013", "Daniel", "Castro", "Logistics & Supply Coordinator", "OPS", 30000m, "LandBank", "013456789012"),
            ("EMP-0014", "Angela", "Aquino", "Facilities & Admin Supervisor", "OPS", 36000m, "Metrobank", "014567890123"),
            ("EMP-0015", "Paolo", "Navarro", "Enterprise Account Executive", "SLS", 50000m, "BDO", "015678901234"),
            ("EMP-0016", "Katrina", "Salazar", "Business Development Rep", "SLS", 32000m, "BPI", "016789012345"),
            ("EMP-0017", "Mark", "Mercado", "Growth Marketing Specialist", "SLS", 35000m, "UnionBank", "017890123456"),
            ("EMP-0018", "Jasmine", "Pascual", "Customer Success Team Lead", "CS", 40000m, "BDO", "018901234567"),
            ("EMP-0019", "Christian", "Domingo", "Technical Support Engineer", "CS", 28000m, "BPI", "019012345678"),
            ("EMP-0020", "Clarisse", "Soriano", "Customer Support Specialist", "CS", 24000m, "LandBank", "020123456789"),
            ("EMP-0021", "Adrian", "Lim", "Senior Systems Administrator", "ENG", 50000m, "Metrobank", "021234567890"),
            ("EMP-0022", "Bianca", "Tan", "Data & BI Analyst", "ENG", 48000m, "UnionBank", "022345678901"),
            ("EMP-0023", "Joshua", "Chua", "Mobile Application Engineer", "ENG", 46000m, "BDO", "023456789012"),
            ("EMP-0024", "Denise", "Sy", "Tax & Regulatory Analyst", "FIN", 38000m, "BPI", "024567890123"),
            ("EMP-0025", "Kevin", "Ong", "Supply Chain Analyst", "OPS", 32000m, "Metrobank", "025678901234"),
            ("EMP-0026", "Alyssa", "De Guzman", "Training & Development Specialist", "HR", 33000m, "LandBank", "026789012345"),
            ("EMP-0027", "Patrick", "Morales", "Client Relationship Manager", "SLS", 42000m, "BDO", "027890123456"),
            ("EMP-0028", "Hannah", "Tolentino", "Helpdesk Operations Specialist", "CS", 26000m, "BPI", "028901234567"),
            ("EMP-0029", "Jerome", "Valdez", "Backend API Engineer", "ENG", 45000m, "UnionBank", "029012345678"),
            ("EMP-0030", "Mikaela", "Aguilar", "Procurement Associate", "OPS", 35000m, "BDO", "030123456789")
        };

        var employees = new List<Employee>();
        for (int i = 0; i < seedList.Length; i++)
        {
            var item = seedList[i];
            var dailyRate = Math.Round(item.Salary * 12m / 261m, 4);
            var hourlyRate = Math.Round(dailyRate / 8m, 4);
            var empNum = i + 1;

            employees.Add(new Employee
            {
                EmployeeCode = item.Code,
                FirstName = item.First,
                LastName = item.Last,
                JobTitle = item.Title,
                DepartmentId = deptMap[item.DeptCode],
                Email = $"{item.First.ToLowerInvariant()}.{item.Last.ToLowerInvariant().Replace(" ", "")}@payroll.local",
                EmploymentStatus = "Regular",
                PayFrequency = "SemiMonthly",
                BasicMonthlySalary = item.Salary,
                DailyRate = dailyRate,
                HourlyRate = hourlyRate,
                HireDate = new DateOnly(2023, 1 + (i % 11), 1 + (i % 25)),
                ShiftStartTime = new TimeOnly(9, 0),
                ShiftEndTime = new TimeOnly(18, 0),
                TinNumber = $"{100 + empNum:D3}-{200 + empNum:D3}-{300 + empNum:D3}-000",
                SssNumber = $"34-{1000000 + empNum:D7}-{empNum % 9}",
                PhilHealthNumber = $"12-{200000000 + empNum:D9}-{empNum % 9}",
                PagIbigNumber = $"1210-{3000 + empNum:D4}-{4000 + empNum:D4}",
                BankName = item.Bank,
                BankAccountNumber = item.Account,
                IsActive = true
            });
        }

        db.Employees.AddRange(employees);
        await db.SaveChangesAsync();

        // 4. Ensure Leave Types & Seed 2026 Leave Balances for all 30
        var vl = await db.LeaveTypes.FirstOrDefaultAsync(l => l.Code == "VL");
        if (vl is null)
        {
            vl = new LeaveType { Code = "VL", Name = "Vacation Leave", DefaultDaysPerYear = 15m, IsPaid = true };
            db.LeaveTypes.Add(vl);
        }
        var sl = await db.LeaveTypes.FirstOrDefaultAsync(l => l.Code == "SL");
        if (sl is null)
        {
            sl = new LeaveType { Code = "SL", Name = "Sick Leave", DefaultDaysPerYear = 15m, IsPaid = true };
            db.LeaveTypes.Add(sl);
        }
        var el = await db.LeaveTypes.FirstOrDefaultAsync(l => l.Code == "EL");
        if (el is null)
        {
            el = new LeaveType { Code = "EL", Name = "Emergency Leave", DefaultDaysPerYear = 5m, IsPaid = true };
            db.LeaveTypes.Add(el);
        }
        await db.SaveChangesAsync();

        const int currentYear = 2026;
        var balances = new List<LeaveBalance>();
        foreach (var emp in employees)
        {
            balances.Add(new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = vl.Id, Year = currentYear, EntitledDays = 15m, UsedDays = 1m });
            balances.Add(new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = sl.Id, Year = currentYear, EntitledDays = 15m, UsedDays = 0m });
            balances.Add(new LeaveBalance { EmployeeId = emp.Id, LeaveTypeId = el.Id, Year = currentYear, EntitledDays = 5m, UsedDays = 0m });
        }
        db.LeaveBalances.AddRange(balances);

        // 5. Attendance Logs across 10 workdays in cutoff (2026-11-02 to 2026-11-13)
        var workDays = new[]
        {
            new DateOnly(2026, 11, 2),  // Mon
            new DateOnly(2026, 11, 3),  // Tue
            new DateOnly(2026, 11, 4),  // Wed
            new DateOnly(2026, 11, 5),  // Thu
            new DateOnly(2026, 11, 6),  // Fri
            new DateOnly(2026, 11, 9),  // Mon
            new DateOnly(2026, 11, 10), // Tue
            new DateOnly(2026, 11, 11), // Wed
            new DateOnly(2026, 11, 12), // Thu
            new DateOnly(2026, 11, 13)  // Fri
        };

        var attendanceLogs = new List<AttendanceLog>();
        foreach (var emp in employees)
        {
            foreach (var wDate in workDays)
            {
                // Realistic variance for regular employees:
                if (emp.EmployeeCode == "EMP-0004" && wDate == new DateOnly(2026, 11, 4))
                {
                    attendanceLogs.Add(new AttendanceLog
                    {
                        EmployeeId = emp.Id,
                        WorkDate = wDate,
                        ClockIn = new TimeOnly(9, 25),
                        ClockOut = new TimeOnly(18, 0),
                        Status = "Late",
                        HoursWorked = 7.58m,
                        LateMinutes = 25,
                        UndertimeMinutes = 0,
                        Remarks = "Traffic congestion on EDSA"
                    });
                }
                else if (emp.EmployeeCode == "EMP-0010" && wDate == new DateOnly(2026, 11, 10))
                {
                    attendanceLogs.Add(new AttendanceLog
                    {
                        EmployeeId = emp.Id,
                        WorkDate = wDate,
                        ClockIn = new TimeOnly(9, 0),
                        ClockOut = new TimeOnly(17, 0),
                        Status = "Undertime",
                        HoursWorked = 7.0m,
                        LateMinutes = 0,
                        UndertimeMinutes = 60,
                        Remarks = "Approved early medical appointment"
                    });
                }
                else if (emp.EmployeeCode == "EMP-0013" && wDate == new DateOnly(2026, 11, 12))
                {
                    attendanceLogs.Add(new AttendanceLog
                    {
                        EmployeeId = emp.Id,
                        WorkDate = wDate,
                        ClockIn = null,
                        ClockOut = null,
                        Status = "OnLeave",
                        HoursWorked = 0m,
                        LateMinutes = 0,
                        UndertimeMinutes = 0,
                        Remarks = "Approved Vacation Leave"
                    });
                }
                else
                {
                    attendanceLogs.Add(new AttendanceLog
                    {
                        EmployeeId = emp.Id,
                        WorkDate = wDate,
                        ClockIn = new TimeOnly(8, 50),
                        ClockOut = new TimeOnly(18, 0),
                        Status = "Present",
                        HoursWorked = 8.0m,
                        LateMinutes = 0,
                        UndertimeMinutes = 0,
                        Remarks = "Regular shift"
                    });
                }
            }
        }
        db.AttendanceLogs.AddRange(attendanceLogs);

        // 6. Sample Approved Overtime Requests
        var otRequests = new List<OvertimeRequest>();
        var otSeed = new[]
        {
            ("EMP-0001", new DateOnly(2026, 11, 4), 3.0m, "RegularOT", 1.25m, "Production core release"),
            ("EMP-0002", new DateOnly(2026, 11, 5), 2.0m, "RegularOT", 1.25m, "Automated regression suite"),
            ("EMP-0003", new DateOnly(2026, 11, 7), 4.0m, "RestDayOT", 1.30m, "Weekend database maintenance"),
            ("EMP-0009", new DateOnly(2026, 11, 6), 3.0m, "RegularOT", 1.25m, "Financial period close preparation"),
            ("EMP-0010", new DateOnly(2026, 11, 9), 2.5m, "RegularOT", 1.25m, "Tax schedule reconciliation"),
            ("EMP-0015", new DateOnly(2026, 11, 8), 4.0m, "RestDayOT", 1.30m, "Client RFP weekend preparation"),
            ("EMP-0019", new DateOnly(2026, 11, 12), 3.0m, "RegularOT", 1.25m, "Critical escalated helpdesk tickets"),
            ("EMP-0029", new DateOnly(2026, 11, 13), 2.0m, "RegularOT", 1.25m, "API optimization patches")
        };

        foreach (var (empCode, date, hrs, otType, mult, reason) in otSeed)
        {
            var emp = employees.First(e => e.EmployeeCode == empCode);
            otRequests.Add(new OvertimeRequest
            {
                EmployeeId = emp.Id,
                WorkDate = date,
                Hours = hrs,
                OvertimeType = otType,
                Multiplier = mult,
                ComputedAmount = Math.Round(emp.HourlyRate * hrs * mult, 2),
                Reason = reason,
                Status = "Approved",
                ReviewRemarks = "Approved by Manager",
                ReviewedAtUtc = DateTime.UtcNow
            });
        }
        db.OvertimeRequests.AddRange(otRequests);

        // 7. Dynamic Allowances (All 30 get Rice, 15 get Transpo, 10 get Meal, 5 get Performance Bonus)
        var allowances = new List<EmployeeAllowance>();
        foreach (var emp in employees)
        {
            // All 30 get Rice Subsidy
            allowances.Add(new EmployeeAllowance
            {
                EmployeeId = emp.Id,
                Category = "Earning",
                GroupName = "Allowance",
                Code = "RICE",
                Name = "Rice Subsidy",
                Amount = 2000m,
                IsTaxable = false,
                Frequency = "Monthly",
                IsActive = true
            });
        }

        for (int i = 0; i < 15; i++)
        {
            allowances.Add(new EmployeeAllowance
            {
                EmployeeId = employees[i].Id,
                Category = "Earning",
                GroupName = "Allowance",
                Code = "TRANSPO",
                Name = "Transportation Allowance",
                Amount = 1500m,
                IsTaxable = false,
                Frequency = "Monthly",
                IsActive = true
            });
        }

        for (int i = 0; i < 10; i++)
        {
            allowances.Add(new EmployeeAllowance
            {
                EmployeeId = employees[i].Id,
                Category = "Earning",
                GroupName = "Allowance",
                Code = "MEAL",
                Name = "Meal Allowance",
                Amount = 1200m,
                IsTaxable = false,
                Frequency = "Monthly",
                IsActive = true
            });
        }

        var bonusIndices = new[] { 0, 8, 11, 14, 26 };
        foreach (var idx in bonusIndices)
        {
            allowances.Add(new EmployeeAllowance
            {
                EmployeeId = employees[idx].Id,
                Category = "Earning",
                GroupName = "Bonus & Incentive",
                Code = "BONUS",
                Name = "Performance Bonus",
                Amount = 3500m,
                IsTaxable = true,
                Frequency = "Monthly",
                IsActive = true
            });
        }
        db.EmployeeAllowances.AddRange(allowances);

        // 8. Company Benefits Catalog & Enrollments
        var hmo = await db.CompanyBenefits.FirstOrDefaultAsync(b => b.Code == "HMO_EXEC");
        if (hmo is null)
        {
            hmo = new CompanyBenefit { Code = "HMO_EXEC", Name = "Executive Medical, Dental & Optical Plan", Category = "Health & Wellness", CoverageAmount = 250_000m, IsTaxable = false, IsActive = true };
            db.CompanyBenefits.Add(hmo);
            await db.SaveChangesAsync();
        }

        var gym = await db.CompanyBenefits.FirstOrDefaultAsync(b => b.Code == "GYM_FIT");
        if (gym is null)
        {
            gym = new CompanyBenefit { Code = "GYM_FIT", Name = "Gym Membership & Fitness Subsidy", Category = "Health & Wellness", CoverageAmount = 15_000m, IsTaxable = false, IsActive = true };
            db.CompanyBenefits.Add(gym);
            await db.SaveChangesAsync();
        }

        var enrollments = new List<EmployeeBenefitEnrollment>();
        foreach (var emp in employees)
        {
            enrollments.Add(new EmployeeBenefitEnrollment
            {
                EmployeeId = emp.Id,
                CompanyBenefitId = hmo.Id,
                EnrollmentDate = new DateOnly(2026, 1, 1),
                CoverageAmount = 250_000m,
                Status = "Active"
            });
        }

        for (int i = 0; i < 12; i++)
        {
            enrollments.Add(new EmployeeBenefitEnrollment
            {
                EmployeeId = employees[i].Id,
                CompanyBenefitId = gym.Id,
                EnrollmentDate = new DateOnly(2026, 1, 15),
                CoverageAmount = 15_000m,
                Status = "Active"
            });
        }
        db.EmployeeBenefitEnrollments.AddRange(enrollments);

        // 9. Employee Loans
        var emp2 = employees.First(e => e.EmployeeCode == "EMP-0002");
        var emp5 = employees.First(e => e.EmployeeCode == "EMP-0005");
        var emp12 = employees.First(e => e.EmployeeCode == "EMP-0012");
        var emp20 = employees.First(e => e.EmployeeCode == "EMP-0020");

        db.EmployeeLoans.AddRange(
            new EmployeeLoan
            {
                EmployeeId = emp2.Id,
                LoanType = "SSS Salary Loan",
                ReferenceNumber = "SSS-2026-0811",
                PrincipalAmount = 30000m,
                TotalAmountDue = 32400m,
                MonthlyAmortization = 1350m,
                AmortizationPerCutoff = 675m,
                RemainingBalance = 18900m,
                TermMonths = 24,
                StartDate = new DateOnly(2026, 1, 15),
                EndDate = new DateOnly(2027, 12, 31),
                Status = "Active"
            },
            new EmployeeLoan
            {
                EmployeeId = emp5.Id,
                LoanType = "Pag-IBIG Multi-Purpose Loan (MPL)",
                ReferenceNumber = "HDMF-MPL-9021",
                PrincipalAmount = 25000m,
                TotalAmountDue = 27000m,
                MonthlyAmortization = 1125m,
                AmortizationPerCutoff = 562.50m,
                RemainingBalance = 15750m,
                TermMonths = 24,
                StartDate = new DateOnly(2026, 2, 1),
                EndDate = new DateOnly(2028, 1, 31),
                Status = "Active"
            },
            new EmployeeLoan
            {
                EmployeeId = emp12.Id,
                LoanType = "Company Emergency Loan",
                ReferenceNumber = "CO-EMG-104",
                PrincipalAmount = 15000m,
                TotalAmountDue = 15000m,
                MonthlyAmortization = 1250m,
                AmortizationPerCutoff = 625m,
                RemainingBalance = 7500m,
                TermMonths = 12,
                StartDate = new DateOnly(2026, 5, 1),
                EndDate = new DateOnly(2027, 4, 30),
                Status = "Active"
            },
            new EmployeeLoan
            {
                EmployeeId = emp20.Id,
                LoanType = "Salary Advance",
                ReferenceNumber = "ADV-2026-004",
                PrincipalAmount = 10000m,
                TotalAmountDue = 10000m,
                MonthlyAmortization = 2500m,
                AmortizationPerCutoff = 1250m,
                RemainingBalance = 2500m,
                TermMonths = 4,
                StartDate = new DateOnly(2026, 9, 1),
                EndDate = new DateOnly(2026, 12, 31),
                Status = "Active"
            }
        );

        // 10. Link default admin user if present
        var adminUser = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin@payroll.local");
        if (adminUser is not null)
        {
            adminUser.EmployeeId = employees[0].Id;
        }

        // 11. Ensure active Payroll Period exists and is in Draft status
        var defaultPeriod = await db.PayrollPeriods.FirstOrDefaultAsync(p => p.Code == "2026-11-A");
        if (defaultPeriod is null)
        {
            defaultPeriod = new PayrollPeriod
            {
                Code = "2026-11-A",
                Name = "Nov 01 – Nov 15, 2026 (1st Cutoff)",
                PayFrequency = "SemiMonthly",
                CutoffSlot = 1,
                StartDate = new DateOnly(2026, 11, 1),
                EndDate = new DateOnly(2026, 11, 15),
                PayDate = new DateOnly(2026, 11, 15),
                Status = "Draft"
            };
            db.PayrollPeriods.Add(defaultPeriod);
        }
        else
        {
            defaultPeriod.Status = "Draft";
            defaultPeriod.ComputedAtUtc = null;
            defaultPeriod.FinalizedAtUtc = null;
        }

        await db.SaveChangesAsync();

        return (employees.Count, attendanceLogs.Count, otRequests.Count, allowances.Count);
    }
}
