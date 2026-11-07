using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;
using Payroll.Api.Data.Seed;
using Payroll.Api.Features.Employees;

namespace Payroll.Api.Features.PayrollEngine;

public static class AllowanceSlice
{
    public record CreateAllowanceTypeRequest(
        string Code,
        string Name,
        string? Category,
        string? GroupName,
        decimal DefaultAmount,
        bool IsTaxable,
        string DefaultFrequency);

    public record SaveEmployeeAllowanceRequest(
        Guid EmployeeId,
        Guid? AllowanceTypeId,
        string? Category,
        string? GroupName,
        string? Code,
        string Name,
        decimal Amount,
        bool IsTaxable,
        string Frequency,
        bool IsActive = true);

    public class SaveEmployeeAllowanceValidator : AbstractValidator<SaveEmployeeAllowanceRequest>
    {
        public SaveEmployeeAllowanceValidator()
        {
            RuleFor(x => x.EmployeeId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
            RuleFor(x => x.Amount).GreaterThan(0);
            RuleFor(x => x.Frequency).Must(f => f is "Monthly" or "PerCutoff");
        }
    }

    public static void MapAllowanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/payroll/allowances")
            .WithTags("Phase 3: Payroll Calculation Engine & Dynamic Earnings/Deductions")
            .RequireAuthorization();

        // ====================================================================
        // 1. DYNAMIC EARNINGS & DEDUCTIONS CATALOG (Rice, Transpo, Bonus, Cash Advance, HMO, etc.)
        // ====================================================================
        group.MapGet("/types", async (string? category, AppDbContext db) =>
        {
            var query = db.AllowanceTypes
                .AsNoTracking()
                .Where(t => t.IsActive);

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(t => t.Category == category);

            var types = await query
                .OrderBy(t => t.Category)
                .ThenBy(t => t.GroupName)
                .ThenBy(t => t.Code)
                .ToListAsync();

            return Results.Ok(types);
        });

        group.MapPost("/types", async (CreateAllowanceTypeRequest req, AppDbContext db) =>
        {
            var code = req.Code.Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { message = "Code and Name are required." });

            if (await db.AllowanceTypes.AnyAsync(t => t.Code == code))
                return Results.Conflict(new { message = $"Component type '{code}' already exists." });

            var category = req.Category is "Deduction" ? "Deduction" : "Earning";
            var defaultGroup = category == "Deduction" ? "Other Deduction" : "Allowance";
            var groupName = string.IsNullOrWhiteSpace(req.GroupName)
                ? defaultGroup
                : req.GroupName.Trim();

            var entity = new AllowanceType
            {
                Code = code,
                Name = req.Name.Trim(),
                Category = category,
                GroupName = groupName,
                DefaultAmount = req.DefaultAmount,
                IsTaxable = category == "Earning" && req.IsTaxable,
                DefaultFrequency = req.DefaultFrequency is "Monthly" or "PerCutoff" ? req.DefaultFrequency : "Monthly",
                IsActive = true
            };

            db.AllowanceTypes.Add(entity);
            await db.SaveChangesAsync();
            return Results.Created($"/api/payroll/allowances/types/{entity.Id}", entity);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // ====================================================================
        // 2. PER-EMPLOYEE DYNAMIC EARNINGS & DEDUCTIONS ASSIGNMENTS
        // ====================================================================
        group.MapGet("/", async (Guid? employeeId, string? category, AppDbContext db) =>
        {
            var query = db.EmployeeAllowances
                .AsNoTracking()
                .Include(a => a.Employee)
                .AsQueryable();

            if (employeeId.HasValue)
                query = query.Where(a => a.EmployeeId == employeeId.Value);

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(a => a.Category == category);

            var list = await query
                .OrderBy(a => a.Employee!.LastName)
                .ThenBy(a => a.Category)
                .ThenBy(a => a.GroupName)
                .ThenBy(a => a.Code)
                .Select(a => new
                {
                    a.Id,
                    a.EmployeeId,
                    EmployeeCode = a.Employee != null ? a.Employee.EmployeeCode : "",
                    EmployeeName = a.Employee != null ? a.Employee.LastName + ", " + a.Employee.FirstName : "",
                    a.AllowanceTypeId,
                    a.Category,
                    a.GroupName,
                    a.Code,
                    a.Name,
                    a.Amount,
                    a.IsTaxable,
                    a.Frequency,
                    a.IsActive
                })
                .ToListAsync();

            return Results.Ok(list);
        });

        group.MapPost("/", async (
            SaveEmployeeAllowanceRequest request,
            IValidator<SaveEmployeeAllowanceRequest> validator,
            AppDbContext db,
            IMemoryCache cache) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var empExists = await db.Employees.AnyAsync(e => e.Id == request.EmployeeId);
            if (!empExists)
                return Results.BadRequest(new { message = "Employee not found." });

            var category = request.Category is "Deduction" ? "Deduction" : "Earning";
            var groupName = string.IsNullOrWhiteSpace(request.GroupName)
                ? (category == "Deduction" ? "Other Deduction" : "Allowance")
                : request.GroupName.Trim();

            var resolvedCode = string.IsNullOrWhiteSpace(request.Code)
                ? (category == "Deduction" ? "DED" : "ALW")
                : request.Code.Trim().ToUpperInvariant();

            if (request.AllowanceTypeId.HasValue)
            {
                var aType = await db.AllowanceTypes.FirstOrDefaultAsync(t => t.Id == request.AllowanceTypeId.Value);
                if (aType is not null)
                {
                    if (string.IsNullOrWhiteSpace(request.Code))
                        resolvedCode = aType.Code;
                    if (string.IsNullOrWhiteSpace(request.Category))
                        category = aType.Category;
                    if (string.IsNullOrWhiteSpace(request.GroupName))
                        groupName = aType.GroupName;
                }
            }

            var allowance = new EmployeeAllowance
            {
                EmployeeId = request.EmployeeId,
                AllowanceTypeId = request.AllowanceTypeId,
                Category = category,
                GroupName = groupName,
                Code = resolvedCode,
                Name = request.Name.Trim(),
                Amount = request.Amount,
                IsTaxable = category == "Earning" && request.IsTaxable,
                Frequency = request.Frequency,
                IsActive = request.IsActive
            };

            db.EmployeeAllowances.Add(allowance);
            await db.SaveChangesAsync();
            EmployeeCacheHelper.Invalidate(cache);

            return Results.Created($"/api/payroll/allowances/{allowance.Id}", new
            {
                allowance.Id,
                allowance.Category,
                allowance.GroupName,
                allowance.Code,
                allowance.Name,
                allowance.Amount,
                allowance.IsTaxable,
                allowance.Frequency,
                allowance.IsActive
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapPut("/{id:guid}", async (
            Guid id,
            SaveEmployeeAllowanceRequest request,
            IValidator<SaveEmployeeAllowanceRequest> validator,
            AppDbContext db,
            IMemoryCache cache) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var allowance = await db.EmployeeAllowances.FirstOrDefaultAsync(a => a.Id == id);
            if (allowance is null)
                return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(request.Code))
                allowance.Code = request.Code.Trim().ToUpperInvariant();
            if (!string.IsNullOrWhiteSpace(request.Category))
                allowance.Category = request.Category is "Deduction" ? "Deduction" : "Earning";
            if (!string.IsNullOrWhiteSpace(request.GroupName))
                allowance.GroupName = request.GroupName.Trim();

            allowance.AllowanceTypeId = request.AllowanceTypeId;
            allowance.Name = request.Name.Trim();
            allowance.Amount = request.Amount;
            allowance.IsTaxable = allowance.Category == "Earning" && request.IsTaxable;
            allowance.Frequency = request.Frequency;
            allowance.IsActive = request.IsActive;

            await db.SaveChangesAsync();
            EmployeeCacheHelper.Invalidate(cache);
            return Results.Ok(new
            {
                allowance.Id,
                allowance.Category,
                allowance.GroupName,
                allowance.Code,
                allowance.Name,
                allowance.Amount,
                allowance.IsTaxable,
                allowance.Frequency,
                allowance.IsActive
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, IMemoryCache cache) =>
        {
            var allowance = await db.EmployeeAllowances.FirstOrDefaultAsync(a => a.Id == id);
            if (allowance is null)
                return Results.NotFound();

            db.EmployeeAllowances.Remove(allowance);
            await db.SaveChangesAsync();
            EmployeeCacheHelper.Invalidate(cache);
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // Bulk seed random dynamic allowances & deductions across all employees
        group.MapPost("/seed-random", async (bool? overwrite, AppDbContext db, IMemoryCache cache) =>
        {
            var (employeesSeeded, itemsCreated) = await DatabaseSeeder.SeedRandomAllowancesForAllEmployeesAsync(
                db,
                overwriteExisting: overwrite ?? true);

            EmployeeCacheHelper.Invalidate(cache);

            return Results.Ok(new
            {
                EmployeesSeeded = employeesSeeded,
                ItemsCreated = itemsCreated
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);
    }
}
