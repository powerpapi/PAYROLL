using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;
using Payroll.Api.Data.Seed;

namespace Payroll.Api.Features.Employees;

public class EmployeeListItemDto
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string EmploymentStatus { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string ShiftStartTime { get; set; } = string.Empty;
    public string ShiftEndTime { get; set; } = string.Empty;
    public string PayFrequency { get; set; } = string.Empty;
    public decimal BasicMonthlySalary { get; set; }
    public decimal DailyRate { get; set; }
    public decimal HourlyRate { get; set; }
    public int AllowanceCount { get; set; }
    public decimal MonthlyAllowanceTotal { get; set; }
    public int DeductionCount { get; set; }
    public decimal MonthlyDeductionTotal { get; set; }
    public string? TinNumber { get; set; }
    public string? SssNumber { get; set; }
    public string? PhilHealthNumber { get; set; }
    public string? PagIbigNumber { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public bool IsActive { get; set; }
}

public static class EmployeeCacheHelper
{
    private const string VersionKey = "EmployeeCache_Version";

    public static long GetVersion(IMemoryCache cache)
    {
        return cache.GetOrCreate(VersionKey, entry =>
        {
            entry.Priority = CacheItemPriority.NeverRemove;
            return DateTime.UtcNow.Ticks;
        });
    }

    public static void Invalidate(IMemoryCache cache)
    {
        cache.Set(VersionKey, DateTime.UtcNow.Ticks, new MemoryCacheEntryOptions
        {
            Priority = CacheItemPriority.NeverRemove
        });
    }
}

public static class EmployeeSlices
{
    public record SaveEmployeeRequest(
        string EmployeeCode,
        string FirstName,
        string LastName,
        string? MiddleName,
        string Email,
        DateOnly HireDate,
        string EmploymentStatus,
        string JobTitle,
        Guid DepartmentId,
        string? ShiftStartTime,
        string? ShiftEndTime,
        string PayFrequency,
        decimal BasicMonthlySalary,
        string? TinNumber,
        string? SssNumber,
        string? PhilHealthNumber,
        string? PagIbigNumber,
        string? BankName,
        string? BankAccountNumber,
        bool IsActive = true);

    public class SaveEmployeeValidator : AbstractValidator<SaveEmployeeRequest>
    {
        public SaveEmployeeValidator()
        {
            RuleFor(x => x.EmployeeCode).NotEmpty().MaximumLength(32);
            RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
            RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
            RuleFor(x => x.BasicMonthlySalary).GreaterThan(0);
            RuleFor(x => x.DepartmentId).NotEmpty();
        }
    }

    public static void MapEmployeeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/employees")
            .WithTags("Phase 1: Employees")
            .RequireAuthorization();

        group.MapGet("/departments", async (AppDbContext db) =>
        {
            var departments = await db.Departments
                .AsNoTracking()
                .OrderBy(d => d.Name)
                .Select(d => new { d.Id, d.Code, d.Name })
                .ToListAsync();
            return Results.Ok(departments);
        });

        group.MapGet("/", async (
            string? search,
            Guid? departmentId,
            string? status,
            AppDbContext db,
            IMemoryCache cache) =>
        {
            var cacheVersion = EmployeeCacheHelper.GetVersion(cache);
            var cacheKey = $"employees_v{cacheVersion}_{search?.Trim().ToLowerInvariant()}_{departmentId}_{status?.Trim()}";

            if (cache.TryGetValue(cacheKey, out List<EmployeeListItemDto>? cached) && cached is not null)
            {
                return Results.Ok(cached);
            }

            var query = db.Employees
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(e =>
                    e.EmployeeCode.ToLower().Contains(term) ||
                    e.FirstName.ToLower().Contains(term) ||
                    e.LastName.ToLower().Contains(term) ||
                    e.Email.ToLower().Contains(term) ||
                    e.JobTitle.ToLower().Contains(term));
            }

            if (departmentId.HasValue)
            {
                query = query.Where(e => e.DepartmentId == departmentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(e => e.EmploymentStatus == status);
            }

            var employees = await query
                .OrderBy(e => e.LastName)
                .ThenBy(e => e.FirstName)
                .Select(e => new EmployeeListItemDto
                {
                    Id = e.Id,
                    EmployeeCode = e.EmployeeCode,
                    FirstName = e.FirstName,
                    LastName = e.LastName,
                    MiddleName = e.MiddleName,
                    Email = e.Email,
                    HireDate = e.HireDate,
                    JobTitle = e.JobTitle,
                    EmploymentStatus = e.EmploymentStatus,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : "",
                    ShiftStartTime = e.ShiftStartTime.ToString("HH:mm"),
                    ShiftEndTime = e.ShiftEndTime.ToString("HH:mm"),
                    PayFrequency = e.PayFrequency,
                    BasicMonthlySalary = e.BasicMonthlySalary,
                    DailyRate = e.DailyRate,
                    HourlyRate = e.HourlyRate,
                    TinNumber = e.TinNumber,
                    SssNumber = e.SssNumber,
                    PhilHealthNumber = e.PhilHealthNumber,
                    PagIbigNumber = e.PagIbigNumber,
                    BankName = e.BankName,
                    BankAccountNumber = e.BankAccountNumber,
                    IsActive = e.IsActive
                })
                .ToListAsync();

            if (employees.Count > 0)
            {
                var employeeIds = employees.Select(e => e.Id).ToList();

                var activeAllowances = await db.EmployeeAllowances
                    .AsNoTracking()
                    .Where(a => a.IsActive && employeeIds.Contains(a.EmployeeId))
                    .Select(a => new
                    {
                        a.EmployeeId,
                        a.Category,
                        a.Frequency,
                        a.Amount
                    })
                    .ToListAsync();

                var grouped = activeAllowances
                    .GroupBy(a => a.EmployeeId)
                    .ToDictionary(
                        g => g.Key,
                        g => new
                        {
                            AllowanceCount = g.Count(a => a.Category != "Deduction"),
                            MonthlyAllowanceTotal = g.Where(a => a.Category != "Deduction")
                                .Sum(a => a.Frequency == "PerCutoff" ? a.Amount * 2m : a.Amount),
                            DeductionCount = g.Count(a => a.Category == "Deduction"),
                            MonthlyDeductionTotal = g.Where(a => a.Category == "Deduction")
                                .Sum(a => a.Frequency == "PerCutoff" ? a.Amount * 2m : a.Amount)
                        });

                foreach (var emp in employees)
                {
                    if (grouped.TryGetValue(emp.Id, out var summary))
                    {
                        emp.AllowanceCount = summary.AllowanceCount;
                        emp.MonthlyAllowanceTotal = summary.MonthlyAllowanceTotal;
                        emp.DeductionCount = summary.DeductionCount;
                        emp.MonthlyDeductionTotal = summary.MonthlyDeductionTotal;
                    }
                }
            }

            cache.Set(cacheKey, employees, new MemoryCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromMinutes(2),
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            });

            return Results.Ok(employees);
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var employee = await db.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .Where(e => e.Id == id)
                .Select(e => new
                {
                    e.Id,
                    e.EmployeeCode,
                    e.FirstName,
                    e.LastName,
                    e.MiddleName,
                    e.Email,
                    e.HireDate,
                    e.JobTitle,
                    e.EmploymentStatus,
                    e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : "",
                    ShiftStartTime = e.ShiftStartTime.ToString("HH:mm"),
                    ShiftEndTime = e.ShiftEndTime.ToString("HH:mm"),
                    e.PayFrequency,
                    e.BasicMonthlySalary,
                    e.DailyRate,
                    e.HourlyRate,
                    AllowanceCount = db.EmployeeAllowances.Count(a => a.EmployeeId == e.Id && a.IsActive && a.Category != "Deduction"),
                    MonthlyAllowanceTotal = db.EmployeeAllowances
                        .Where(a => a.EmployeeId == e.Id && a.IsActive && a.Category != "Deduction")
                        .Sum(a => (decimal?)(a.Frequency == "PerCutoff" ? a.Amount * 2m : a.Amount)) ?? 0m,
                    DeductionCount = db.EmployeeAllowances.Count(a => a.EmployeeId == e.Id && a.IsActive && a.Category == "Deduction"),
                    MonthlyDeductionTotal = db.EmployeeAllowances
                        .Where(a => a.EmployeeId == e.Id && a.IsActive && a.Category == "Deduction")
                        .Sum(a => (decimal?)(a.Frequency == "PerCutoff" ? a.Amount * 2m : a.Amount)) ?? 0m,
                    e.TinNumber,
                    e.SssNumber,
                    e.PhilHealthNumber,
                    e.PagIbigNumber,
                    e.BankName,
                    e.BankAccountNumber,
                    e.IsActive
                })
                .FirstOrDefaultAsync();

            return employee is not null ? Results.Ok(employee) : Results.NotFound();
        });

        group.MapPost("/", async (
            SaveEmployeeRequest request,
            IValidator<SaveEmployeeRequest> validator,
            AppDbContext db,
            IMemoryCache cache) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var exists = await db.Employees.AnyAsync(e =>
                e.EmployeeCode == request.EmployeeCode || e.Email == request.Email);
            if (exists)
                return Results.Conflict(new { message = "Employee with the same code or email already exists." });

            var dailyRate = Math.Round(request.BasicMonthlySalary * 12m / 261m, 4);
            var hourlyRate = Math.Round(dailyRate / 8m, 4);

            var shiftStart = TimeOnly.TryParse(request.ShiftStartTime, out var ss) ? ss : new TimeOnly(9, 0);
            var shiftEnd = TimeOnly.TryParse(request.ShiftEndTime, out var se) ? se : new TimeOnly(18, 0);

            var employee = new Employee
            {
                EmployeeCode = request.EmployeeCode.Trim(),
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                MiddleName = request.MiddleName?.Trim(),
                Email = request.Email.Trim().ToLowerInvariant(),
                HireDate = request.HireDate,
                EmploymentStatus = request.EmploymentStatus,
                JobTitle = request.JobTitle.Trim(),
                DepartmentId = request.DepartmentId,
                ShiftStartTime = shiftStart,
                ShiftEndTime = shiftEnd,
                PayFrequency = request.PayFrequency,
                BasicMonthlySalary = request.BasicMonthlySalary,
                DailyRate = dailyRate,
                HourlyRate = hourlyRate,
                TinNumber = request.TinNumber,
                SssNumber = request.SssNumber,
                PhilHealthNumber = request.PhilHealthNumber,
                PagIbigNumber = request.PagIbigNumber,
                BankName = request.BankName,
                BankAccountNumber = request.BankAccountNumber,
                IsActive = true
            };

            db.Employees.Add(employee);
            await db.SaveChangesAsync();
            EmployeeCacheHelper.Invalidate(cache);

            return Results.Created($"/api/employees/{employee.Id}", new { employee.Id, employee.EmployeeCode });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapPut("/{id:guid}", async (
            Guid id,
            SaveEmployeeRequest request,
            IValidator<SaveEmployeeRequest> validator,
            AppDbContext db,
            IMemoryCache cache) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id);
            if (employee is null)
                return Results.NotFound();

            var duplicate = await db.Employees.AnyAsync(e =>
                e.Id != id && (e.EmployeeCode == request.EmployeeCode || e.Email == request.Email));
            if (duplicate)
                return Results.Conflict(new { message = "Another employee already uses that employee code or email." });

            var dailyRate = Math.Round(request.BasicMonthlySalary * 12m / 261m, 4);
            var hourlyRate = Math.Round(dailyRate / 8m, 4);

            var shiftStart = TimeOnly.TryParse(request.ShiftStartTime, out var ss) ? ss : employee.ShiftStartTime;
            var shiftEnd = TimeOnly.TryParse(request.ShiftEndTime, out var se) ? se : employee.ShiftEndTime;

            employee.EmployeeCode = request.EmployeeCode.Trim();
            employee.FirstName = request.FirstName.Trim();
            employee.LastName = request.LastName.Trim();
            employee.MiddleName = request.MiddleName?.Trim();
            employee.Email = request.Email.Trim().ToLowerInvariant();
            employee.HireDate = request.HireDate;
            employee.EmploymentStatus = request.EmploymentStatus;
            employee.JobTitle = request.JobTitle.Trim();
            employee.DepartmentId = request.DepartmentId;
            employee.ShiftStartTime = shiftStart;
            employee.ShiftEndTime = shiftEnd;
            employee.PayFrequency = request.PayFrequency;
            employee.BasicMonthlySalary = request.BasicMonthlySalary;
            employee.DailyRate = dailyRate;
            employee.HourlyRate = hourlyRate;
            employee.TinNumber = request.TinNumber;
            employee.SssNumber = request.SssNumber;
            employee.PhilHealthNumber = request.PhilHealthNumber;
            employee.PagIbigNumber = request.PagIbigNumber;
            employee.BankName = request.BankName;
            employee.BankAccountNumber = request.BankAccountNumber;
            employee.IsActive = request.IsActive;

            await db.SaveChangesAsync();
            EmployeeCacheHelper.Invalidate(cache);
            return Results.Ok(new { employee.Id, employee.EmployeeCode });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // Bulk generate up to 1,000 realistic employees
        group.MapPost("/seed-bulk", async (int? targetCount, AppDbContext db, IMemoryCache cache) =>
        {
            var desiredTotal = targetCount ?? 1000;
            var existingCodes = (await db.Employees
                .AsNoTracking()
                .Select(e => e.EmployeeCode)
                .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var existingEmails = (await db.Employees
                .AsNoTracking()
                .Select(e => e.Email)
                .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var departments = await db.Departments.ToListAsync();
            if (departments.Count == 0)
            {
                departments.AddRange(
                    new Department { Code = "ENG", Name = "Engineering" },
                    new Department { Code = "HR", Name = "Human Resources" },
                    new Department { Code = "FIN", Name = "Finance & Accounting" },
                    new Department { Code = "OPS", Name = "Operations" },
                    new Department { Code = "SLS", Name = "Sales & Marketing" }
                );
                db.Departments.AddRange(departments);
                await db.SaveChangesAsync();
            }

            string[] firstNames =
            [
                "Juan", "Maria", "Jose", "Ana", "Carlo", "Bea", "miguel", "Sofia", "Gabriel", "Camille",
                "Rafael", "Patricia", "Daniel", "Angela", "Paolo", "Katrina", "Mark", "Jasmine", "Christian", "Clarisse",
                "Adrian", "Bianca", "Joshua", "Denise", "Kevin", "Alyssa", "patrick", "Hannah", "Jerome", "Mikaela"
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

            var toAdd = new List<Employee>();
            var rng = new Random(20261031);

            for (int i = 1; i <= desiredTotal; i++)
            {
                var code = $"EMP-{i:D4}";
                if (existingCodes.Contains(code))
                    continue;

                var fn = firstNames[(i - 1) % firstNames.Length];
                fn = char.ToUpper(fn[0]) + fn[1..];
                var ln = lastNames[((i - 1) / firstNames.Length + i) % lastNames.Length];
                var emailSlug = $"{fn.ToLowerInvariant().Replace(" ", "")}.{ln.ToLowerInvariant().Replace(" ", "")}.{i}@payroll.local";

                if (existingEmails.Contains(emailSlug))
                    continue;

                var dept = departments[i % departments.Count];
                var title = jobTitles[i % jobTitles.Length];
                var status = employmentStatuses[i % employmentStatuses.Length];
                var bank = banks[i % banks.Length];

                // Monthly salary between 18,000 and 95,000 in 500-peso increments
                var monthlySalary = 18000m + (rng.Next(0, 155) * 500m);
                var dailyRate = Math.Round(monthlySalary * 12m / 261m, 4);
                var hourlyRate = Math.Round(dailyRate / 8m, 4);

                toAdd.Add(new Employee
                {
                    EmployeeCode = code,
                    FirstName = fn,
                    LastName = ln,
                    Email = emailSlug,
                    HireDate = new DateOnly(2020 + (i % 6), 1 + (i % 12), 1 + (i % 27)),
                    EmploymentStatus = status,
                    JobTitle = title,
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
                    BankName = bank,
                    BankAccountNumber = $"00{1000000000L + i}",
                    IsActive = true
                });

                existingCodes.Add(code);
                existingEmails.Add(emailSlug);
            }

            if (toAdd.Count > 0)
            {
                await db.Employees.AddRangeAsync(toAdd);
                await db.SaveChangesAsync();
            }

            EmployeeCacheHelper.Invalidate(cache);

            var totalNow = await db.Employees.CountAsync();
            return Results.Ok(new
            {
                AddedCount = toAdd.Count,
                TotalEmployees = totalNow
            });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // Reset system to exactly 30 regular employees with attendance, leaves, OT, allowances, benefits & loans
        group.MapPost("/reset-to-thirty-regular", async (AppDbContext db, IMemoryCache cache) =>
        {
            var result = await DatabaseSeeder.ResetToThirtyRegularEmployeesAsync(db);
            EmployeeCacheHelper.Invalidate(cache);
            return Results.Ok(new
            {
                message = "System successfully reset to 30 regular employees with complete timekeeping, leaves, OT, allowances, benefits and loans.",
                employeesCount = result.EmployeesCount,
                attendanceLogsCount = result.AttendanceCount,
                overtimeRequestsCount = result.OvertimeCount,
                allowancesCount = result.LeavesCount
            });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);
    }
}
