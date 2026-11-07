using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.PayrollApproval;

public static class PayrollApprovalSlice
{
    public record ApprovalActionRequest(string? Remarks);
    public record RejectActionRequest(string Remarks);

    public record AnomalyItem(
        Guid EmployeeId,
        string EmployeeCode,
        string EmployeeName,
        string DepartmentName,
        string AnomalyType,
        string Severity, // "Critical", "Warning", "Info"
        string Description,
        decimal Amount);

    public record MetricComparison(
        string MetricName,
        decimal CurrentValue,
        decimal PreviousValue,
        decimal AbsoluteChange,
        decimal PercentChange,
        bool IsIncrease);

    public static void MapPayrollApprovalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/payroll/approvals")
            .WithTags("Phase 5: Payroll Approval and Finalization")
            .RequireAuthorization();

        // 1. List all Payroll Periods for Approval Pipeline
        group.MapGet("/", async (AppDbContext db) =>
        {
            var list = await db.PayrollPeriods
                .AsNoTracking()
                .OrderByDescending(p => p.StartDate)
                .Select(p => new
                {
                    p.Id,
                    p.Code,
                    p.Name,
                    p.PayFrequency,
                    p.CutoffSlot,
                    p.StartDate,
                    p.EndDate,
                    p.PayDate,
                    p.Status,
                    p.ComputedAtUtc,
                    p.SubmittedAtUtc,
                    p.SubmittedByEmail,
                    p.ReviewStartedAtUtc,
                    p.ReviewStartedByEmail,
                    p.ApprovedAtUtc,
                    p.ApprovedByEmail,
                    p.FinalizedAtUtc,
                    p.FinalizedByEmail,
                    p.RejectionRemarks,
                    EmployeeCount = p.Items.Count,
                    TotalGrossPay = p.Items.Sum(i => (decimal?)i.GrossPay) ?? 0m,
                    TotalEmployeeContributions = p.Items.Sum(i => (decimal?)i.TotalEmployeeContributions) ?? 0m,
                    TotalEmployerContributions = p.Items.Sum(i => (decimal?)i.TotalEmployerContributions) ?? 0m,
                    TotalWithholdingTax = p.Items.Sum(i => (decimal?)i.WithholdingTax) ?? 0m,
                    TotalOtherDeductions = p.Items.Sum(i => (decimal?)i.OtherDeductions) ?? 0m,
                    TotalNetPay = p.Items.Sum(i => (decimal?)i.NetPay) ?? 0m,
                    TotalAttendanceDeductions = p.Items.Sum(i => (decimal?)(i.AbsenceDeduction + i.LateUndertimeDeduction)) ?? 0m,
                    TotalOvertimePay = p.Items.Sum(i => (decimal?)i.OvertimePay) ?? 0m
                })
                .ToListAsync();

            return Results.Ok(list);
        });

        // 2. Automated Period-Over-Period Variance & Anomaly Detection Report
        group.MapGet("/{id:guid}/variance", async (Guid id, AppDbContext db) =>
        {
            var current = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                        .ThenInclude(e => e!.Department)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (current is null)
                return Results.NotFound();

            // Find preceding period with the same pay frequency
            var previous = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                .Where(p => p.Id != id && p.PayFrequency == current.PayFrequency && p.StartDate < current.StartDate)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync();

            var curItems = current.Items.ToList();
            var prevItems = previous?.Items.ToList() ?? new List<PayrollItem>();

            // Metric comparisons
            var curHeadcount = curItems.Count;
            var prevHeadcount = prevItems.Count;

            var curGross = curItems.Sum(i => i.GrossPay);
            var prevGross = prevItems.Sum(i => i.GrossPay);

            var curNet = curItems.Sum(i => i.NetPay);
            var prevNet = prevItems.Sum(i => i.NetPay);

            var curTax = curItems.Sum(i => i.WithholdingTax);
            var prevTax = prevItems.Sum(i => i.WithholdingTax);

            var curContrib = curItems.Sum(i => i.TotalEmployeeContributions);
            var prevContrib = prevItems.Sum(i => i.TotalEmployeeContributions);

            var curOT = curItems.Sum(i => i.OvertimePay);
            var prevOT = prevItems.Sum(i => i.OvertimePay);

            var curAttDed = curItems.Sum(i => i.AbsenceDeduction + i.LateUndertimeDeduction);
            var prevAttDed = prevItems.Sum(i => i.AbsenceDeduction + i.LateUndertimeDeduction);

            static MetricComparison BuildComparison(string name, decimal cur, decimal prev)
            {
                var diff = cur - prev;
                var pct = prev > 0 ? Math.Round((diff / prev) * 100m, 2) : 0m;
                return new MetricComparison(name, cur, prev, diff, pct, diff >= 0);
            }

            var comparisons = new List<MetricComparison>
            {
                BuildComparison("Headcount", curHeadcount, prevHeadcount),
                BuildComparison("Total Gross Pay", curGross, prevGross),
                BuildComparison("Total Net Pay", curNet, prevNet),
                BuildComparison("Withholding Tax", curTax, prevTax),
                BuildComparison("Employee Contributions", curContrib, prevContrib),
                BuildComparison("Overtime Pay", curOT, prevOT),
                BuildComparison("Attendance Deductions", curAttDed, prevAttDed)
            };

            // Anomaly & Outlier Rules
            var anomalies = new List<AnomalyItem>();

            foreach (var item in curItems)
            {
                var emp = item.Employee;
                var code = emp?.EmployeeCode ?? "N/A";
                var name = emp != null ? $"{emp.LastName}, {emp.FirstName}" : "Unknown";
                var dept = emp?.Department?.Name ?? "General";

                // Flag 1: Net Pay is Zero or Negative
                if (item.NetPay <= 0)
                {
                    anomalies.Add(new AnomalyItem(
                        item.EmployeeId,
                        code,
                        name,
                        dept,
                        "ZeroNetPay",
                        "Critical",
                        "Employee net take-home pay is ₱0.00 or negative.",
                        item.NetPay));
                }

                // Flag 2: Overtime Spike (OT pay exceeds 35% of basic pay)
                if (item.BasicPay > 0 && (item.OvertimePay / item.BasicPay) > 0.35m)
                {
                    anomalies.Add(new AnomalyItem(
                        item.EmployeeId,
                        code,
                        name,
                        dept,
                        "HighOvertime",
                        "Warning",
                        $"Overtime pay (₱{item.OvertimePay:N2}) exceeds 35% of cutoff basic pay.",
                        item.OvertimePay));
                }

                // Flag 3: Excessive Attendance Deductions (>3 absent days or large tardiness)
                if (item.AbsentDays >= 3)
                {
                    anomalies.Add(new AnomalyItem(
                        item.EmployeeId,
                        code,
                        name,
                        dept,
                        "HighAbsences",
                        "Warning",
                        $"Employee logged {item.AbsentDays} absent days resulting in ₱{item.AbsenceDeduction:N2} deduction.",
                        item.AbsenceDeduction));
                }

                // Flag 4: Gross Pay Variance vs Previous Period (>25% shift)
                var prevItem = prevItems.FirstOrDefault(pi => pi.EmployeeId == item.EmployeeId);
                if (prevItem is not null && prevItem.GrossPay > 0)
                {
                    var shift = Math.Abs(item.GrossPay - prevItem.GrossPay) / prevItem.GrossPay;
                    if (shift > 0.25m)
                    {
                        var direction = item.GrossPay > prevItem.GrossPay ? "increase" : "decrease";
                        anomalies.Add(new AnomalyItem(
                            item.EmployeeId,
                            code,
                            name,
                            dept,
                            "SalaryVariance",
                            "Info",
                            $"Gross pay experienced a {shift * 100m:0.#}% {direction} compared to previous cutoff (₱{prevItem.GrossPay:N2} → ₱{item.GrossPay:N2}).",
                            item.GrossPay - prevItem.GrossPay));
                    }
                }
            }

            return Results.Ok(new
            {
                PeriodId = current.Id,
                current.Code,
                current.Name,
                CurrentStatus = current.Status,
                HasPreviousPeriod = previous is not null,
                PreviousPeriodCode = previous?.Code,
                Comparisons = comparisons,
                TotalAnomaliesCount = anomalies.Count,
                CriticalAnomaliesCount = anomalies.Count(a => a.Severity == "Critical"),
                WarningAnomaliesCount = anomalies.Count(a => a.Severity == "Warning"),
                Anomalies = anomalies.OrderByDescending(a => a.Severity == "Critical").ThenBy(a => a.EmployeeName).ToList()
            });
        });

        // 3. Immutable Governance Audit Trail
        group.MapGet("/{id:guid}/audit-trail", async (Guid id, AppDbContext db) =>
        {
            var logs = await db.PayrollApprovalLogs
                .AsNoTracking()
                .Where(l => l.PayrollPeriodId == id)
                .OrderByDescending(l => l.CreatedAtUtc)
                .Select(l => new
                {
                    l.Id,
                    l.Action,
                    l.FromStatus,
                    l.ToStatus,
                    l.UserEmail,
                    l.UserRole,
                    l.Remarks,
                    l.CreatedAtUtc
                })
                .ToListAsync();

            return Results.Ok(logs);
        });

        // 4. SUBMIT FOR APPROVAL (Payroll Officer or Admin)
        group.MapPost("/{id:guid}/submit", async (
            Guid id,
            ApprovalActionRequest? req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (period is null)
                return Results.NotFound();

            if (period.Status == "Finalized")
                return Results.BadRequest(new { message = "Period is finalized and cannot be resubmitted." });

            if (period.Items.Count == 0)
                return Results.BadRequest(new { message = "Cannot submit an empty payroll run. Please compute payroll first." });

            var fromStatus = period.Status;
            var (userId, email, role) = ExtractUser(principal);

            period.Status = "PendingReview";
            period.SubmittedAtUtc = DateTime.UtcNow;
            period.SubmittedByUserId = userId;
            period.SubmittedByEmail = email;
            period.RejectionRemarks = null;

            db.PayrollApprovalLogs.Add(new PayrollApprovalLog
            {
                PayrollPeriodId = period.Id,
                Action = "Submit",
                FromStatus = fromStatus,
                ToStatus = "PendingReview",
                UserId = userId,
                UserEmail = email,
                UserRole = role,
                Remarks = req?.Remarks ?? "Payroll submitted for verification and approval."
            });

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.SubmittedAtUtc,
                period.SubmittedByEmail
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // 5. START REVIEW (HR, Manager, or Admin)
        group.MapPost("/{id:guid}/start-review", async (
            Guid id,
            ApprovalActionRequest? req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var period = await db.PayrollPeriods.FirstOrDefaultAsync(p => p.Id == id);
            if (period is null)
                return Results.NotFound();

            if (period.Status != "PendingReview")
                return Results.BadRequest(new { message = $"Cannot start review from status '{period.Status}'. Status must be 'PendingReview'." });

            var fromStatus = period.Status;
            var (userId, email, role) = ExtractUser(principal);

            period.Status = "UnderReview";
            period.ReviewStartedAtUtc = DateTime.UtcNow;
            period.ReviewStartedByUserId = userId;
            period.ReviewStartedByEmail = email;

            db.PayrollApprovalLogs.Add(new PayrollApprovalLog
            {
                PayrollPeriodId = period.Id,
                Action = "StartReview",
                FromStatus = fromStatus,
                ToStatus = "UnderReview",
                UserId = userId,
                UserEmail = email,
                UserRole = role,
                Remarks = req?.Remarks ?? "Payroll verification and variance check initiated."
            });

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.ReviewStartedAtUtc,
                period.ReviewStartedByEmail
            });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // 6. APPROVE PAYROLL RUN (HR, Manager, or Admin)
        group.MapPost("/{id:guid}/approve", async (
            Guid id,
            ApprovalActionRequest? req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var period = await db.PayrollPeriods.FirstOrDefaultAsync(p => p.Id == id);
            if (period is null)
                return Results.NotFound();

            if (period.Status is not ("PendingReview" or "UnderReview"))
                return Results.BadRequest(new { message = $"Cannot approve payroll run in '{period.Status}' status. Must be 'PendingReview' or 'UnderReview'." });

            var fromStatus = period.Status;
            var (userId, email, role) = ExtractUser(principal);

            period.Status = "Approved";
            period.ApprovedAtUtc = DateTime.UtcNow;
            period.ApprovedByUserId = userId;
            period.ApprovedByEmail = email;

            db.PayrollApprovalLogs.Add(new PayrollApprovalLog
            {
                PayrollPeriodId = period.Id,
                Action = "Approve",
                FromStatus = fromStatus,
                ToStatus = "Approved",
                UserId = userId,
                UserEmail = email,
                UserRole = role,
                Remarks = req?.Remarks ?? "Payroll verification passed and approved."
            });

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.ApprovedAtUtc,
                period.ApprovedByEmail
            });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // 7. REJECT PAYROLL RUN (Reverts to Rejected / Draft for adjustments)
        group.MapPost("/{id:guid}/reject", async (
            Guid id,
            RejectActionRequest req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Remarks))
                return Results.BadRequest(new { message = "Rejection remarks are required to provide feedback for corrections." });

            var period = await db.PayrollPeriods.FirstOrDefaultAsync(p => p.Id == id);
            if (period is null)
                return Results.NotFound();

            if (period.Status == "Finalized")
                return Results.BadRequest(new { message = "Finalized payroll periods are locked and cannot be rejected." });

            var fromStatus = period.Status;
            var (userId, email, role) = ExtractUser(principal);

            period.Status = "Rejected";
            period.RejectionRemarks = req.Remarks.Trim();

            db.PayrollApprovalLogs.Add(new PayrollApprovalLog
            {
                PayrollPeriodId = period.Id,
                Action = "Reject",
                FromStatus = fromStatus,
                ToStatus = "Rejected",
                UserId = userId,
                UserEmail = email,
                UserRole = role,
                Remarks = req.Remarks.Trim()
            });

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.RejectionRemarks
            });
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // 8. FINALIZE & LOCK PAYROLL RUN (Admin Only)
        group.MapPost("/{id:guid}/finalize", async (
            Guid id,
            ApprovalActionRequest? req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var period = await db.PayrollPeriods.FirstOrDefaultAsync(p => p.Id == id);
            if (period is null)
                return Results.NotFound();

            if (period.Status != "Approved")
                return Results.BadRequest(new { message = $"Cannot finalize payroll run in '{period.Status}' status. It must be 'Approved' first." });

            var fromStatus = period.Status;
            var (userId, email, role) = ExtractUser(principal);

            period.Status = "Finalized";
            period.FinalizedAtUtc = DateTime.UtcNow;
            period.FinalizedByUserId = userId;
            period.FinalizedByEmail = email;

            db.PayrollApprovalLogs.Add(new PayrollApprovalLog
            {
                PayrollPeriodId = period.Id,
                Action = "Finalize",
                FromStatus = fromStatus,
                ToStatus = "Finalized",
                UserId = userId,
                UserEmail = email,
                UserRole = role,
                Remarks = req?.Remarks ?? "Payroll run finalized and permanently locked."
            });

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.FinalizedAtUtc,
                period.FinalizedByEmail,
                message = "Payroll run successfully finalized and locked."
            });
        }).RequireAuthorization(RbacPolicies.AdminOnly);
    }

    private static (Guid? UserId, string Email, string Role) ExtractUser(ClaimsPrincipal principal)
    {
        var idStr = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        Guid? userId = Guid.TryParse(idStr, out var parsed) ? parsed : null;
        var email = principal.FindFirstValue(ClaimTypes.Email) ?? principal.FindFirstValue("email") ?? "system@payroll.local";
        var role = principal.FindFirstValue(ClaimTypes.Role) ?? "User";
        return (userId, email, role);
    }
}
