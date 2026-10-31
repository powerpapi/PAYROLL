using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Timekeeping;

public static class AttendanceSlice
{
    public record SaveAttendanceRequest(
        Guid EmployeeId,
        DateOnly WorkDate,
        string? ClockIn,   // "09:00"
        string? ClockOut,  // "18:00"
        string Status,     // Present, Late, Absent, OnLeave, Holiday, RestDay
        string? Remarks);

    public class SaveAttendanceValidator : AbstractValidator<SaveAttendanceRequest>
    {
        public SaveAttendanceValidator()
        {
            RuleFor(x => x.EmployeeId).NotEmpty();
            RuleFor(x => x.WorkDate).NotEmpty();
            RuleFor(x => x.Status).NotEmpty();
        }
    }

    public static void MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/timekeeping/attendance")
            .WithTags("Phase 2: Attendance, Leave & Overtime")
            .RequireAuthorization();

        group.MapGet("/", async (
            Guid? employeeId,
            DateOnly? startDate,
            DateOnly? endDate,
            AppDbContext db) =>
        {
            var query = db.AttendanceLogs
                .AsNoTracking()
                .Include(a => a.Employee)
                .AsQueryable();

            if (employeeId.HasValue)
                query = query.Where(a => a.EmployeeId == employeeId.Value);

            if (startDate.HasValue)
                query = query.Where(a => a.WorkDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(a => a.WorkDate <= endDate.Value);

            var logs = await query
                .OrderByDescending(a => a.WorkDate)
                .ThenBy(a => a.Employee!.LastName)
                .Select(a => new
                {
                    a.Id,
                    a.EmployeeId,
                    EmployeeCode = a.Employee != null ? a.Employee.EmployeeCode : "",
                    EmployeeName = a.Employee != null ? a.Employee.LastName + ", " + a.Employee.FirstName : "",
                    ShiftSchedule = a.Employee != null
                        ? a.Employee.ShiftStartTime.ToString("HH:mm") + "–" + a.Employee.ShiftEndTime.ToString("HH:mm")
                        : "09:00–18:00",
                    a.WorkDate,
                    ClockIn = a.ClockIn.HasValue ? a.ClockIn.Value.ToString("HH:mm") : null,
                    ClockOut = a.ClockOut.HasValue ? a.ClockOut.Value.ToString("HH:mm") : null,
                    a.Status,
                    a.HoursWorked,
                    a.LateMinutes,
                    a.UndertimeMinutes,
                    a.Remarks
                })
                .ToListAsync();

            return Results.Ok(logs);
        });

        // Upsert daily attendance record & auto-compute HoursWorked, LateMinutes, UndertimeMinutes against Employee's Shift Schedule
        group.MapPost("/", async (
            SaveAttendanceRequest request,
            IValidator<SaveAttendanceRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == request.EmployeeId);
            if (employee is null)
                return Results.BadRequest(new { message = "Employee not found." });

            TimeOnly? clockIn = TimeOnly.TryParse(request.ClockIn, out var ci) ? ci : null;
            TimeOnly? clockOut = TimeOnly.TryParse(request.ClockOut, out var co) ? co : null;

            decimal hoursWorked = 0m;
            int lateMinutes = 0;
            int undertimeMinutes = 0;
            var resolvedStatus = request.Status;

            if (clockIn.HasValue && clockOut.HasValue && clockOut.Value > clockIn.Value)
            {
                var shiftStart = employee.ShiftStartTime;
                var shiftEnd = employee.ShiftEndTime;

                if (clockIn.Value > shiftStart)
                {
                    lateMinutes = (int)(clockIn.Value - shiftStart).TotalMinutes;
                    if (resolvedStatus == "Present" && lateMinutes > 0)
                        resolvedStatus = "Late";
                }

                if (clockOut.Value < shiftEnd)
                {
                    undertimeMinutes = (int)(shiftEnd - clockOut.Value).TotalMinutes;
                }

                var rawHours = (decimal)(clockOut.Value - clockIn.Value).TotalHours;
                hoursWorked = Math.Round(rawHours > 5m ? rawHours - 1m : rawHours, 2);
                if (hoursWorked > 8m) hoursWorked = 8m;
            }

            var existing = await db.AttendanceLogs.FirstOrDefaultAsync(a =>
                a.EmployeeId == request.EmployeeId && a.WorkDate == request.WorkDate);

            if (existing is null)
            {
                existing = new AttendanceLog
                {
                    EmployeeId = request.EmployeeId,
                    WorkDate = request.WorkDate,
                    ClockIn = clockIn,
                    ClockOut = clockOut,
                    Status = resolvedStatus,
                    HoursWorked = hoursWorked,
                    LateMinutes = lateMinutes,
                    UndertimeMinutes = undertimeMinutes,
                    Remarks = request.Remarks
                };
                db.AttendanceLogs.Add(existing);
            }
            else
            {
                existing.ClockIn = clockIn;
                existing.ClockOut = clockOut;
                existing.Status = resolvedStatus;
                existing.HoursWorked = hoursWorked;
                existing.LateMinutes = lateMinutes;
                existing.UndertimeMinutes = undertimeMinutes;
                existing.Remarks = request.Remarks;
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { existing.Id, existing.Status, existing.HoursWorked, existing.LateMinutes, existing.UndertimeMinutes });
        });

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var log = await db.AttendanceLogs.FirstOrDefaultAsync(a => a.Id == id);
            if (log is null)
                return Results.NotFound();

            db.AttendanceLogs.Remove(log);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);
    }
}
