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

            CREATE TABLE IF NOT EXISTS "EmployeeAllowances" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
                "Name" character varying(128) NOT NULL,
                "Amount" numeric(18,4) NOT NULL,
                "IsTaxable" boolean NOT NULL,
                "Frequency" character varying(32) NOT NULL,
                "IsActive" boolean NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
            );

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
                "NetPay" numeric(18,4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "IX_PayrollItems_PayrollPeriodId_EmployeeId" UNIQUE ("PayrollPeriodId", "EmployeeId")
            );

            CREATE TABLE IF NOT EXISTS "PayrollItemLines" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "PayrollItemId" uuid NOT NULL REFERENCES "PayrollItems"("Id") ON DELETE CASCADE,
                "LineType" character varying(32) NOT NULL,
                "Code" character varying(32) NOT NULL,
                "Description" character varying(256) NOT NULL,
                "Amount" numeric(18,4) NOT NULL,
                "EmployerAmount" numeric(18,4) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NULL
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

        // 4. Seed Phase 3 Sample Allowances & Initial Payroll Period
        if (!await db.EmployeeAllowances.AnyAsync())
        {
            var employees = await db.Employees.OrderBy(e => e.EmployeeCode).Take(25).ToListAsync();
            foreach (var emp in employees)
            {
                db.EmployeeAllowances.AddRange(
                    new EmployeeAllowance
                    {
                        EmployeeId = emp.Id,
                        Name = "Rice Subsidy (De Minimis)",
                        Amount = 2000m,
                        IsTaxable = false,
                        Frequency = "Monthly",
                        IsActive = true
                    },
                    new EmployeeAllowance
                    {
                        EmployeeId = emp.Id,
                        Name = "Transportation Allowance",
                        Amount = 1500m,
                        IsTaxable = true,
                        Frequency = "Monthly",
                        IsActive = true
                    }
                );
            }
        }

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

        await db.SaveChangesAsync();
    }
}
