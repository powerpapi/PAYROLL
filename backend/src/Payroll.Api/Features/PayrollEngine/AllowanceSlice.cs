using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.PayrollEngine;

public static class AllowanceSlice
{
    public record CreateAllowanceRequest(
        Guid EmployeeId,
        string Name,
        decimal Amount,
        bool IsTaxable,
        string Frequency); // Monthly, PerCutoff

    public class CreateAllowanceValidator : AbstractValidator<CreateAllowanceRequest>
    {
        public CreateAllowanceValidator()
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
            .WithTags("Phase 3: Payroll Calculation Engine")
            .RequireAuthorization();

        group.MapGet("/", async (Guid? employeeId, AppDbContext db) =>
        {
            var query = db.EmployeeAllowances
                .AsNoTracking()
                .Include(a => a.Employee)
                .Where(a => a.IsActive);

            if (employeeId.HasValue)
                query = query.Where(a => a.EmployeeId == employeeId.Value);

            var list = await query
                .OrderBy(a => a.Employee!.LastName)
                .ThenBy(a => a.Name)
                .Select(a => new
                {
                    a.Id,
                    a.EmployeeId,
                    EmployeeCode = a.Employee != null ? a.Employee.EmployeeCode : "",
                    EmployeeName = a.Employee != null ? a.Employee.LastName + ", " + a.Employee.FirstName : "",
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
            CreateAllowanceRequest request,
            IValidator<CreateAllowanceRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var empExists = await db.Employees.AnyAsync(e => e.Id == request.EmployeeId);
            if (!empExists)
                return Results.BadRequest(new { message = "Employee not found." });

            var allowance = new EmployeeAllowance
            {
                EmployeeId = request.EmployeeId,
                Name = request.Name.Trim(),
                Amount = request.Amount,
                IsTaxable = request.IsTaxable,
                Frequency = request.Frequency,
                IsActive = true
            };

            db.EmployeeAllowances.Add(allowance);
            await db.SaveChangesAsync();

            return Results.Created($"/api/payroll/allowances/{allowance.Id}", new { allowance.Id, allowance.Name, allowance.Amount });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var allowance = await db.EmployeeAllowances.FirstOrDefaultAsync(a => a.Id == id);
            if (allowance is null)
                return Results.NotFound();

            db.EmployeeAllowances.Remove(allowance);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);
    }
}
