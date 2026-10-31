using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Auth;

public static class UserManagementSlice
{
    public record CreateUserRequest(
        string Email,
        string Password,
        string Role,
        Guid? EmployeeId);

    public record UpdateUserRoleStatusRequest(
        string Role,
        bool IsActive,
        Guid? EmployeeId);

    public class CreateUserValidator : AbstractValidator<CreateUserRequest>
    {
        public CreateUserValidator()
        {
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
            RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
            RuleFor(x => x.Role)
                .NotEmpty()
                .Must(r => UserRoles.All.Contains(r))
                .WithMessage($"Role must be one of: {string.Join(", ", UserRoles.All)}");
        }
    }

    public static void MapUserManagementEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Phase 1: Auth & RBAC")
            .RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapGet("/roles", () => Results.Ok(UserRoles.All));

        group.MapGet("/", async (AppDbContext db) =>
        {
            var users = await db.Users
                .AsNoTracking()
                .Include(u => u.Employee)
                .OrderBy(u => u.Email)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.Role,
                    u.IsActive,
                    u.EmployeeId,
                    EmployeeName = u.Employee != null ? u.Employee.FirstName + " " + u.Employee.LastName : null,
                    EmployeeCode = u.Employee != null ? u.Employee.EmployeeCode : null,
                    u.CreatedAtUtc
                })
                .ToListAsync();

            return Results.Ok(users);
        });

        group.MapPost("/", async (
            CreateUserRequest request,
            IValidator<CreateUserRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
                return Results.Conflict(new { message = "A user with this email already exists." });

            if (request.EmployeeId.HasValue)
            {
                var empExists = await db.Employees.AnyAsync(e => e.Id == request.EmployeeId.Value);
                if (!empExists)
                    return Results.BadRequest(new { message = "Linked employee was not found." });

                var alreadyLinked = await db.Users.AnyAsync(u => u.EmployeeId == request.EmployeeId.Value);
                if (alreadyLinked)
                    return Results.Conflict(new { message = "This employee is already linked to another user account." });
            }

            var user = new User
            {
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                EmployeeId = request.EmployeeId,
                IsActive = true
            };

            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Created($"/api/users/{user.Id}", new
            {
                user.Id,
                user.Email,
                user.Role,
                user.EmployeeId,
                user.IsActive
            });
        }).RequireAuthorization(RbacPolicies.AdminOnly);

        group.MapPatch("/{id:guid}/role-status", async (
            Guid id,
            UpdateUserRoleStatusRequest request,
            AppDbContext db) =>
        {
            if (!UserRoles.All.Contains(request.Role))
                return Results.BadRequest(new { message = $"Invalid role '{request.Role}'." });

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user is null)
                return Results.NotFound();

            user.Role = request.Role;
            user.IsActive = request.IsActive;
            user.EmployeeId = request.EmployeeId;

            await db.SaveChangesAsync();
            return Results.Ok(new { user.Id, user.Email, user.Role, user.IsActive, user.EmployeeId });
        }).RequireAuthorization(RbacPolicies.AdminOnly);
    }
}
