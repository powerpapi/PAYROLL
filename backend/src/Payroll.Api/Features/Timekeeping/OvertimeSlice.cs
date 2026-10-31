using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Timekeeping;

public static class OvertimeSlice
{
    public static readonly Dictionary<string, decimal> Multipliers = new()
    {
        ["RegularOT"] = 1.25m,
        ["RestDayOT"] = 1.30m,
        ["SpecialHolidayOT"] = 1.30m,
        ["RegularHolidayOT"] = 2.00m
    };

    public record CreateOvertimeRequestDto(
        Guid EmployeeId,
        DateOnly WorkDate,
        decimal Hours,
        string OvertimeType,
        string Reason);

    public record ReviewOvertimeRequestDto(
        string Status, // Approved, Rejected
        string? ReviewRemarks);

    public class CreateOvertimeValidator : AbstractValidator<CreateOvertimeRequestDto>
    {
        public CreateOvertimeValidator()
        {
            RuleFor(x => x.EmployeeId).NotEmpty();
            RuleFor(x => x.Hours).GreaterThan(0).LessThanOrEqualTo(16);
            RuleFor(x => x.OvertimeType)
                .NotEmpty()
                .Must(t => Multipliers.ContainsKey(t))
                .WithMessage("Invalid OvertimeType.");
            RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        }
    }

    public static void MapOvertimeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/timekeeping/overtime")
            .WithTags("Phase 2: Attendance, Leave & Overtime")
            .RequireAuthorization();

        group.MapGet("/", async (string? status, Guid? employeeId, AppDbContext db) =>
        {
            var query = db.OvertimeRequests
                .AsNoTracking()
                .Include(ot => ot.Employee)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                query = query.Where(ot => ot.Status == status);

            if (employeeId.HasValue)
                query = query.Where(ot => ot.EmployeeId == employeeId.Value);

            var list = await query
                .OrderByDescending(ot => ot.WorkDate)
                .Select(ot => new
                {
                    ot.Id,
                    ot.EmployeeId,
                    EmployeeCode = ot.Employee != null ? ot.Employee.EmployeeCode : "",
                    EmployeeName = ot.Employee != null ? ot.Employee.LastName + ", " + ot.Employee.FirstName : "",
                    HourlyRate = ot.Employee != null ? ot.Employee.HourlyRate : 0m,
                    ot.WorkDate,
                    ot.Hours,
                    ot.OvertimeType,
                    ot.Multiplier,
                    ot.ComputedAmount,
                    ot.Reason,
                    ot.Status,
                    ot.ReviewRemarks,
                    ot.ReviewedAtUtc
                })
                .ToListAsync();

            return Results.Ok(list);
        });

        group.MapPost("/", async (
            CreateOvertimeRequestDto request,
            IValidator<CreateOvertimeRequestDto> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == request.EmployeeId);
            if (employee is null)
                return Results.BadRequest(new { message = "Employee not found." });

            var multiplier = Multipliers[request.OvertimeType];
            var computedAmount = Math.Round(employee.HourlyRate * request.Hours * multiplier, 2);

            var entity = new OvertimeRequest
            {
                EmployeeId = request.EmployeeId,
                WorkDate = request.WorkDate,
                Hours = request.Hours,
                OvertimeType = request.OvertimeType,
                Multiplier = multiplier,
                ComputedAmount = computedAmount,
                Reason = request.Reason.Trim(),
                Status = "Pending"
            };

            db.OvertimeRequests.Add(entity);
            await db.SaveChangesAsync();

            return Results.Created($"/api/timekeeping/overtime/{entity.Id}", new
            {
                entity.Id,
                entity.Multiplier,
                entity.ComputedAmount,
                entity.Status
            });
        });

        group.MapPatch("/{id:guid}/review", async (
            Guid id,
            ReviewOvertimeRequestDto request,
            AppDbContext db) =>
        {
            if (request.Status is not ("Approved" or "Rejected"))
                return Results.BadRequest(new { message = "Status must be Approved or Rejected." });

            var ot = await db.OvertimeRequests.FirstOrDefaultAsync(o => o.Id == id);
            if (ot is null)
                return Results.NotFound();

            if (ot.Status != "Pending")
                return Results.BadRequest(new { message = "Only Pending overtime requests can be reviewed." });

            ot.Status = request.Status;
            ot.ReviewRemarks = request.ReviewRemarks;
            ot.ReviewedAtUtc = DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Results.Ok(new { ot.Id, ot.Status, ot.ComputedAmount, ot.ReviewedAtUtc });
        });
    }
}
