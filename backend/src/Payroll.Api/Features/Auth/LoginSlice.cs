using System.Security.Claims;
using System.Security.Cryptography;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;

namespace Payroll.Api.Features.Auth;

public static class LoginSlice
{
    public record LoginRequest(string Email, string Password);
    public record RefreshTokenRequest(string RefreshToken);
    public record LoginResponse(
        Guid Id,
        string AccessToken,
        string RefreshToken,
        string Email,
        string Role,
        Guid? EmployeeId,
        string? EmployeeName,
        string[] Features);
    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    public class LoginValidator : AbstractValidator<LoginRequest>
    {
        public LoginValidator()
        {
            RuleFor(x => x.Email).NotEmpty().EmailAddress();
            RuleFor(x => x.Password).NotEmpty();
        }
    }

    public class ChangePasswordValidator : AbstractValidator<ChangePasswordRequest>
    {
        public ChangePasswordValidator()
        {
            RuleFor(x => x.CurrentPassword).NotEmpty();
            RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(6);
        }
    }

    private static string GenerateSecureRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    }

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Phase 1: Auth & RBAC");

        group.MapPost("/login", async (
            LoginRequest request,
            IValidator<LoginRequest> validator,
            AppDbContext db,
            JwtTokenGenerator jwt) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var user = await db.Users
                .Include(u => u.Employee)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && u.IsActive);

            if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Results.Problem("Invalid email or password.", statusCode: StatusCodes.Status401Unauthorized);

            var token = jwt.GenerateToken(user);
            var refreshToken = GenerateSecureRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryUtc = DateTime.UtcNow.AddDays(14);
            await db.SaveChangesAsync();

            var empName = user.Employee is not null ? $"{user.Employee.FirstName} {user.Employee.LastName}" : null;
            var features = (await UserManagementSlice.GetEffectiveFeaturesForRoleAsync(db, user.Role)).ToArray();

            return Results.Ok(new LoginResponse(
                user.Id,
                token,
                refreshToken,
                user.Email,
                user.Role,
                user.EmployeeId,
                empName,
                features));
        });

        group.MapPost("/refresh", async (
            RefreshTokenRequest request,
            AppDbContext db,
            JwtTokenGenerator jwt) =>
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
                return Results.Unauthorized();

            var user = await db.Users
                .Include(u => u.Employee)
                .FirstOrDefaultAsync(u =>
                    u.RefreshToken == request.RefreshToken &&
                    u.IsActive &&
                    u.RefreshTokenExpiryUtc > DateTime.UtcNow);

            if (user is null)
                return Results.Unauthorized();

            var newAccessToken = jwt.GenerateToken(user);
            var newRefreshToken = GenerateSecureRefreshToken();
            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpiryUtc = DateTime.UtcNow.AddDays(14);
            await db.SaveChangesAsync();

            var empName = user.Employee is not null ? $"{user.Employee.FirstName} {user.Employee.LastName}" : null;
            var features = (await UserManagementSlice.GetEffectiveFeaturesForRoleAsync(db, user.Role)).ToArray();

            return Results.Ok(new LoginResponse(
                user.Id,
                newAccessToken,
                newRefreshToken,
                user.Email,
                user.Role,
                user.EmployeeId,
                empName,
                features));
        });

        group.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userIdStr = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId))
                return Results.Unauthorized();

            var user = await db.Users
                .AsNoTracking()
                .Include(u => u.Employee)
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.Role,
                    u.EmployeeId,
                    EmployeeName = u.Employee != null ? u.Employee.FirstName + " " + u.Employee.LastName : null
                })
                .FirstOrDefaultAsync();

            if (user is null)
                return Results.NotFound();

            var features = (await UserManagementSlice.GetEffectiveFeaturesForRoleAsync(db, user.Role)).ToArray();

            return Results.Ok(new
            {
                user.Id,
                user.Email,
                user.Role,
                user.EmployeeId,
                user.EmployeeName,
                Features = features
            });
        }).RequireAuthorization();

        group.MapPost("/change-password", async (
            ChangePasswordRequest request,
            IValidator<ChangePasswordRequest> validator,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var userIdStr = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId))
                return Results.Unauthorized();

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null)
                return Results.NotFound();

            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                return Results.BadRequest(new { message = "Current password is incorrect." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await db.SaveChangesAsync();

            return Results.Ok(new { message = "Password updated successfully." });
        }).RequireAuthorization();
    }
}
