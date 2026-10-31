using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Data.Seed;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
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

        // 2. Seed Default Departments & Sample Employees
        if (!await db.Departments.AnyAsync())
        {
            var eng = new Department { Code = "ENG", Name = "Engineering" };
            var hr = new Department { Code = "HR", Name = "Human Resources" };
            var fin = new Department { Code = "FIN", Name = "Finance & Accounting" };

            db.Departments.AddRange(eng, hr, fin);
            await db.SaveChangesAsync();

            if (!await db.Employees.AnyAsync())
            {
                db.Employees.AddRange(
                    new Employee
                    {
                        EmployeeCode = "EMP-0001",
                        FirstName = "Maria",
                        LastName = "Santos",
                        Email = "maria.santos@payroll.local",
                        HireDate = new DateOnly(2023, 3, 15),
                        EmploymentStatus = "Regular",
                        JobTitle = "HR Manager",
                        DepartmentId = hr.Id,
                        PayFrequency = "SemiMonthly",
                        BasicMonthlySalary = 45000m,
                        DailyRate = Math.Round(45000m * 12m / 261m, 4),
                        HourlyRate = Math.Round((45000m * 12m / 261m) / 8m, 4),
                        TinNumber = "123-456-789-000",
                        SssNumber = "34-1234567-8",
                        PhilHealthNumber = "12-098765432-1",
                        PagIbigNumber = "1210-1234-5678",
                        BankName = "BDO",
                        BankAccountNumber = "001234567890"
                    },
                    new Employee
                    {
                        EmployeeCode = "EMP-0002",
                        FirstName = "Juan",
                        LastName = "Dela Cruz",
                        Email = "juan.delacruz@payroll.local",
                        HireDate = new DateOnly(2024, 1, 10),
                        EmploymentStatus = "Regular",
                        JobTitle = "Senior Software Engineer",
                        DepartmentId = eng.Id,
                        PayFrequency = "SemiMonthly",
                        BasicMonthlySalary = 65000m,
                        DailyRate = Math.Round(65000m * 12m / 261m, 4),
                        HourlyRate = Math.Round((65000m * 12m / 261m) / 8m, 4),
                        TinNumber = "987-654-321-000",
                        SssNumber = "34-8765432-1",
                        PhilHealthNumber = "12-123456789-0",
                        PagIbigNumber = "1210-8765-4321",
                        BankName = "BPI",
                        BankAccountNumber = "9988776655"
                    }
                );
            }
        }

        // 3. Seed Default Government Contributions (SSS, PhilHealth, Pag-IBIG)
        // Admins can add more ContributionTypes or update schedules dynamically via API!
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
                        CalculationMode = ContributionCalculationMode.Percentage,
                        EmployeeRatePercent = 2.5m,
                        EmployerRatePercent = 2.5m,
                        SalaryFloor = 10_000m,
                        SalaryCeiling = 100_000m
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
                        CalculationMode = ContributionCalculationMode.Percentage,
                        EmployeeRatePercent = 2.0m,
                        EmployerRatePercent = 2.0m,
                        SalaryFloor = 1_500m,
                        SalaryCeiling = 10_000m
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

        await db.SaveChangesAsync();
    }
}
