using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Employees;

public static class DepartmentSlices
{
    public record SaveDepartmentRequest(string Code, string Name);

    public class SaveDepartmentValidator : AbstractValidator<SaveDepartmentRequest>
    {
        public SaveDepartmentValidator()
        {
            RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
            RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
        }
    }

    public static void MapDepartmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/departments")
            .WithTags("Phase 1: Departments")
            .RequireAuthorization();

        group.MapGet("/", async (AppDbContext db) =>
        {
            var departments = await db.Departments
                .AsNoTracking()
                .OrderBy(d => d.Name)
                .Select(d => new
                {
                    d.Id,
                    d.Code,
                    d.Name,
                    EmployeeCount = d.Employees.Count(e => e.IsActive)
                })
                .ToListAsync();

            return Results.Ok(departments);
        });

        group.MapPost("/", async (
            SaveDepartmentRequest request,
            IValidator<SaveDepartmentRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var code = request.Code.Trim().ToUpperInvariant();
            if (await db.Departments.AnyAsync(d => d.Code == code))
                return Results.Conflict(new { message = $"Department with code '{code}' already exists." });

            var department = new Department
            {
                Code = code,
                Name = request.Name.Trim()
            };

            db.Departments.Add(department);
            await db.SaveChangesAsync();

            return Results.Created($"/api/departments/{department.Id}", new { department.Id, department.Code, department.Name });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapPut("/{id:guid}", async (
            Guid id,
            SaveDepartmentRequest request,
            IValidator<SaveDepartmentRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var department = await db.Departments.FirstOrDefaultAsync(d => d.Id == id);
            if (department is null)
                return Results.NotFound();

            var code = request.Code.Trim().ToUpperInvariant();
            if (await db.Departments.AnyAsync(d => d.Code == code && d.Id != id))
                return Results.Conflict(new { message = $"Department with code '{code}' already exists." });

            department.Code = code;
            department.Name = request.Name.Trim();
            await db.SaveChangesAsync();

            return Results.Ok(new { department.Id, department.Code, department.Name });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);
    }
}
