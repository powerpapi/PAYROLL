using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Employees;

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
            AppDbContext db) =>
        {
            var query = db.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .AsQueryable();

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
                    e.PayFrequency,
                    e.BasicMonthlySalary,
                    e.DailyRate,
                    e.HourlyRate,
                    e.TinNumber,
                    e.SssNumber,
                    e.PhilHealthNumber,
                    e.PagIbigNumber,
                    e.BankName,
                    e.BankAccountNumber,
                    e.IsActive
                })
                .ToListAsync();

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
                    e.PayFrequency,
                    e.BasicMonthlySalary,
                    e.DailyRate,
                    e.HourlyRate,
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
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var exists = await db.Employees.AnyAsync(e =>
                e.EmployeeCode == request.EmployeeCode || e.Email == request.Email);
            if (exists)
                return Results.Conflict(new { message = "Employee with the same code or email already exists." });

            // Standard 261 working days/year (~21.75 days/month) daily & hourly rate derivation
            var dailyRate = Math.Round(request.BasicMonthlySalary * 12m / 261m, 4);
            var hourlyRate = Math.Round(dailyRate / 8m, 4);

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

            return Results.Created($"/api/employees/{employee.Id}", new { employee.Id, employee.EmployeeCode });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapPut("/{id:guid}", async (
            Guid id,
            SaveEmployeeRequest request,
            IValidator<SaveEmployeeRequest> validator,
            AppDbContext db) =>
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

            employee.EmployeeCode = request.EmployeeCode.Trim();
            employee.FirstName = request.FirstName.Trim();
            employee.LastName = request.LastName.Trim();
            employee.MiddleName = request.MiddleName?.Trim();
            employee.Email = request.Email.Trim().ToLowerInvariant();
            employee.HireDate = request.HireDate;
            employee.EmploymentStatus = request.EmploymentStatus;
            employee.JobTitle = request.JobTitle.Trim();
            employee.DepartmentId = request.DepartmentId;
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
            return Results.Ok(new { employee.Id, employee.EmployeeCode });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);
    }
}
