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

    public record UpdateRolePermissionsRequest(List<string> EnabledFeatures);

    public record RolePermissionSummary(
        string Role,
        string[] Features,
        string[] DefaultFeatures,
        bool IsCustomized,
        int TotalEnabled,
        int TotalAvailable);

    public static async Task<List<string>> GetEffectiveFeaturesForRoleAsync(AppDbContext db, string role)
    {
        var rolePermissions = await db.RoleFeaturePermissions
            .AsNoTracking()
            .Where(p => p.Role == role)
            .ToListAsync();

        if (rolePermissions.Count == 0)
        {
            return AppFeatures.GetDefaultFeaturesForRole(role).ToList();
        }

        return rolePermissions
            .Where(p => p.IsEnabled)
            .Select(p => p.FeatureKey)
            .ToList();
    }

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

        // ====================================================================
        // ADVANCED RBAC: FEATURE DEFINITIONS & DYNAMIC ROLE PERMISSIONS
        // ====================================================================

        group.MapGet("/features", () =>
        {
            var features = AppFeatures.All.Select(f => new
            {
                f.Key,
                f.Name,
                f.Description,
                f.Category,
                f.DefaultRoles
            });
            return Results.Ok(features);
        });

        group.MapGet("/roles/permissions", async (AppDbContext db) =>
        {
            var allDbPermissions = await db.RoleFeaturePermissions
                .AsNoTracking()
                .ToListAsync();

            var summaries = new List<RolePermissionSummary>();

            foreach (var role in UserRoles.All)
            {
                var defaultFeatures = AppFeatures.GetDefaultFeaturesForRole(role);
                var roleRows = allDbPermissions.Where(p => string.Equals(p.Role, role, StringComparison.OrdinalIgnoreCase)).ToList();

                string[] effectiveFeatures;
                bool isCustomized;

                if (roleRows.Count == 0)
                {
                    effectiveFeatures = defaultFeatures;
                    isCustomized = false;
                }
                else
                {
                    effectiveFeatures = roleRows.Where(p => p.IsEnabled).Select(p => p.FeatureKey).ToArray();
                    var sortedEffective = effectiveFeatures.OrderBy(x => x).ToArray();
                    var sortedDefault = defaultFeatures.OrderBy(x => x).ToArray();
                    isCustomized = !sortedEffective.SequenceEqual(sortedDefault);
                }

                summaries.Add(new RolePermissionSummary(
                    Role: role,
                    Features: effectiveFeatures,
                    DefaultFeatures: defaultFeatures,
                    IsCustomized: isCustomized,
                    TotalEnabled: effectiveFeatures.Length,
                    TotalAvailable: AppFeatures.All.Length));
            }

            return Results.Ok(summaries);
        });

        group.MapGet("/roles/{role}/permissions", async (string role, AppDbContext db) =>
        {
            if (!UserRoles.All.Contains(role))
                return Results.BadRequest(new { message = $"Invalid role '{role}'." });

            var defaultFeatures = AppFeatures.GetDefaultFeaturesForRole(role);
            var roleRows = await db.RoleFeaturePermissions
                .AsNoTracking()
                .Where(p => p.Role == role)
                .ToListAsync();

            string[] effectiveFeatures;
            bool isCustomized;

            if (roleRows.Count == 0)
            {
                effectiveFeatures = defaultFeatures;
                isCustomized = false;
            }
            else
            {
                effectiveFeatures = roleRows.Where(p => p.IsEnabled).Select(p => p.FeatureKey).ToArray();
                var sortedEffective = effectiveFeatures.OrderBy(x => x).ToArray();
                var sortedDefault = defaultFeatures.OrderBy(x => x).ToArray();
                isCustomized = !sortedEffective.SequenceEqual(sortedDefault);
            }

            return Results.Ok(new RolePermissionSummary(
                Role: role,
                Features: effectiveFeatures,
                DefaultFeatures: defaultFeatures,
                IsCustomized: isCustomized,
                TotalEnabled: effectiveFeatures.Length,
                TotalAvailable: AppFeatures.All.Length));
        });

        group.MapPut("/roles/{role}/permissions", async (
            string role,
            UpdateRolePermissionsRequest request,
            AppDbContext db) =>
        {
            if (!UserRoles.All.Contains(role))
                return Results.BadRequest(new { message = $"Invalid role '{role}'." });

            var existing = await db.RoleFeaturePermissions
                .Where(p => p.Role == role)
                .ToListAsync();

            if (existing.Count > 0)
            {
                db.RoleFeaturePermissions.RemoveRange(existing);
            }

            var enabledSet = request.EnabledFeatures.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var now = DateTime.UtcNow;

            var newEntries = AppFeatures.All.Select(f => new RoleFeaturePermission
            {
                Role = role,
                FeatureKey = f.Key,
                IsEnabled = enabledSet.Contains(f.Key),
                CreatedAtUtc = now
            }).ToList();

            db.RoleFeaturePermissions.AddRange(newEntries);
            await db.SaveChangesAsync();

            var defaultFeatures = AppFeatures.GetDefaultFeaturesForRole(role);
            var effectiveFeatures = newEntries.Where(p => p.IsEnabled).Select(p => p.FeatureKey).ToArray();
            var isCustomized = !effectiveFeatures.OrderBy(x => x).SequenceEqual(defaultFeatures.OrderBy(x => x));

            return Results.Ok(new RolePermissionSummary(
                Role: role,
                Features: effectiveFeatures,
                DefaultFeatures: defaultFeatures,
                IsCustomized: isCustomized,
                TotalEnabled: effectiveFeatures.Length,
                TotalAvailable: AppFeatures.All.Length));
        }).RequireAuthorization(RbacPolicies.AdminOnly);

        group.MapPost("/roles/{role}/permissions/reset", async (string role, AppDbContext db) =>
        {
            if (!UserRoles.All.Contains(role))
                return Results.BadRequest(new { message = $"Invalid role '{role}'." });

            var existing = await db.RoleFeaturePermissions
                .Where(p => p.Role == role)
                .ToListAsync();

            if (existing.Count > 0)
            {
                db.RoleFeaturePermissions.RemoveRange(existing);
            }

            var defaultFeatures = AppFeatures.GetDefaultFeaturesForRole(role);
            var defaultSet = defaultFeatures.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var now = DateTime.UtcNow;

            var newEntries = AppFeatures.All.Select(f => new RoleFeaturePermission
            {
                Role = role,
                FeatureKey = f.Key,
                IsEnabled = defaultSet.Contains(f.Key),
                CreatedAtUtc = now
            }).ToList();

            db.RoleFeaturePermissions.AddRange(newEntries);
            await db.SaveChangesAsync();

            return Results.Ok(new RolePermissionSummary(
                Role: role,
                Features: defaultFeatures,
                DefaultFeatures: defaultFeatures,
                IsCustomized: false,
                TotalEnabled: defaultFeatures.Length,
                TotalAvailable: AppFeatures.All.Length));
        }).RequireAuthorization(RbacPolicies.AdminOnly);
    }
}
