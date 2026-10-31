using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Timekeeping;

public static class LeaveSlice
{
    public record CreateLeaveTypeDto(
        string Code,
        string Name,
        decimal DefaultDaysPerYear,
        bool IsPaid);

    public record CreateLeaveRequestDto(
        Guid EmployeeId,
        Guid LeaveTypeId,
        DateOnly StartDate,
        DateOnly EndDate,
        string Reason);

    public record ReviewLeaveRequestDto(
        string Status, // Approved, Rejected
        string? ReviewRemarks);

    public class CreateLeaveValidator : AbstractValidator<CreateLeaveRequestDto>
    {
        public CreateLeaveValidator()
        {
            RuleFor(x => x.EmployeeId).NotEmpty();
            RuleFor(x => x.LeaveTypeId).NotEmpty();
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
            RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        }
    }

    public static void MapLeaveEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/timekeeping")
            .WithTags("Phase 2: Attendance, Leave & Overtime")
            .RequireAuthorization();

        group.MapGet("/leave-types", async (AppDbContext db) =>
        {
            var types = await db.LeaveTypes
                .AsNoTracking()
                .Where(l => l.IsActive)
                .OrderBy(l => l.Code)
                .ToListAsync();
            return Results.Ok(types);
        });

        group.MapPost("/leave-types", async (CreateLeaveTypeDto req, AppDbContext db) =>
        {
            var code = req.Code.Trim().ToUpperInvariant();
            if (await db.LeaveTypes.AnyAsync(l => l.Code == code))
                return Results.Conflict(new { message = $"Leave type '{code}' already exists." });

            var lt = new LeaveType
            {
                Code = code,
                Name = req.Name.Trim(),
                DefaultDaysPerYear = req.DefaultDaysPerYear,
                IsPaid = req.IsPaid,
                IsActive = true
            };

            db.LeaveTypes.Add(lt);
            await db.SaveChangesAsync();
            return Results.Created($"/api/timekeeping/leave-types/{lt.Id}", lt);
        });

        group.MapGet("/leave-balances", async (Guid? employeeId, int? year, AppDbContext db) =>
        {
            var targetYear = year ?? DateTime.UtcNow.Year;
            var query = db.LeaveBalances
                .AsNoTracking()
                .Include(lb => lb.Employee)
                .Include(lb => lb.LeaveType)
                .Where(lb => lb.Year == targetYear);

            if (employeeId.HasValue)
                query = query.Where(lb => lb.EmployeeId == employeeId.Value);

            var balances = await query
                .OrderBy(lb => lb.Employee!.LastName)
                .ThenBy(lb => lb.LeaveType!.Code)
                .Select(lb => new
                {
                    lb.Id,
                    lb.EmployeeId,
                    EmployeeName = lb.Employee != null ? lb.Employee.LastName + ", " + lb.Employee.FirstName : "",
                    EmployeeCode = lb.Employee != null ? lb.Employee.EmployeeCode : "",
                    lb.LeaveTypeId,
                    LeaveCode = lb.LeaveType != null ? lb.LeaveType.Code : "",
                    LeaveName = lb.LeaveType != null ? lb.LeaveType.Name : "",
                    lb.Year,
                    lb.EntitledDays,
                    lb.UsedDays,
                    RemainingDays = lb.EntitledDays - lb.UsedDays
                })
                .ToListAsync();

            return Results.Ok(balances);
        });

        group.MapGet("/leaves", async (string? status, Guid? employeeId, AppDbContext db) =>
        {
            var query = db.LeaveRequests
                .AsNoTracking()
                .Include(lr => lr.Employee)
                .Include(lr => lr.LeaveType)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                query = query.Where(lr => lr.Status == status);

            if (employeeId.HasValue)
                query = query.Where(lr => lr.EmployeeId == employeeId.Value);

            var requests = await query
                .OrderByDescending(lr => lr.CreatedAtUtc)
                .Select(lr => new
                {
                    lr.Id,
                    lr.EmployeeId,
                    EmployeeCode = lr.Employee != null ? lr.Employee.EmployeeCode : "",
                    EmployeeName = lr.Employee != null ? lr.Employee.LastName + ", " + lr.Employee.FirstName : "",
                    lr.LeaveTypeId,
                    LeaveCode = lr.LeaveType != null ? lr.LeaveType.Code : "",
                    LeaveName = lr.LeaveType != null ? lr.LeaveType.Name : "",
                    IsPaid = lr.LeaveType != null && lr.LeaveType.IsPaid,
                    lr.StartDate,
                    lr.EndDate,
                    lr.TotalDays,
                    lr.Reason,
                    lr.Status,
                    lr.ReviewRemarks,
                    lr.ReviewedAtUtc
                })
                .ToListAsync();

            return Results.Ok(requests);
        });

        group.MapPost("/leaves", async (
            CreateLeaveRequestDto request,
            IValidator<CreateLeaveRequestDto> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var totalDays = (decimal)(request.EndDate.DayNumber - request.StartDate.DayNumber + 1);
            if (totalDays <= 0)
                return Results.BadRequest(new { message = "Invalid leave date range." });

            var leaveType = await db.LeaveTypes.FirstOrDefaultAsync(l => l.Id == request.LeaveTypeId);
            if (leaveType is null)
                return Results.BadRequest(new { message = "Leave type not found." });

            // Check balance if Paid leave
            if (leaveType.IsPaid && leaveType.DefaultDaysPerYear > 0)
            {
                var balance = await db.LeaveBalances.FirstOrDefaultAsync(lb =>
                    lb.EmployeeId == request.EmployeeId &&
                    lb.LeaveTypeId == request.LeaveTypeId &&
                    lb.Year == request.StartDate.Year);

                if (balance is null)
                {
                    balance = new LeaveBalance
                    {
                        EmployeeId = request.EmployeeId,
                        LeaveTypeId = request.LeaveTypeId,
                        Year = request.StartDate.Year,
                        EntitledDays = leaveType.DefaultDaysPerYear,
                        UsedDays = 0m
                    };
                    db.LeaveBalances.Add(balance);
                    await db.SaveChangesAsync();
                }

                if (balance.EntitledDays - balance.UsedDays < totalDays)
                {
                    return Results.BadRequest(new
                    {
                        message = $"Insufficient {leaveType.Code} balance. Remaining: {balance.EntitledDays - balance.UsedDays} day(s)."
                    });
                }
            }

            var entity = new LeaveRequest
            {
                EmployeeId = request.EmployeeId,
                LeaveTypeId = request.LeaveTypeId,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                TotalDays = totalDays,
                Reason = request.Reason.Trim(),
                Status = "Pending"
            };

            db.LeaveRequests.Add(entity);
            await db.SaveChangesAsync();

            return Results.Created($"/api/timekeeping/leaves/{entity.Id}", new { entity.Id, entity.TotalDays, entity.Status });
        });

        group.MapPatch("/leaves/{id:guid}/review", async (
            Guid id,
            ReviewLeaveRequestDto request,
            AppDbContext db) =>
        {
            if (request.Status is not ("Approved" or "Rejected"))
                return Results.BadRequest(new { message = "Status must be Approved or Rejected." });

            var leave = await db.LeaveRequests
                .Include(lr => lr.LeaveType)
                .FirstOrDefaultAsync(lr => lr.Id == id);

            if (leave is null)
                return Results.NotFound();

            if (leave.Status != "Pending")
                return Results.BadRequest(new { message = "Only Pending leave requests can be reviewed." });

            leave.Status = request.Status;
            leave.ReviewRemarks = request.ReviewRemarks;
            leave.ReviewedAtUtc = DateTime.UtcNow;

            if (request.Status == "Approved" && leave.LeaveType is not null && leave.LeaveType.IsPaid)
            {
                var balance = await db.LeaveBalances.FirstOrDefaultAsync(lb =>
                    lb.EmployeeId == leave.EmployeeId &&
                    lb.LeaveTypeId == leave.LeaveTypeId &&
                    lb.Year == leave.StartDate.Year);

                if (balance is not null)
                {
                    balance.UsedDays += leave.TotalDays;
                }
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { leave.Id, leave.Status, leave.ReviewedAtUtc });
        });
    }
}
