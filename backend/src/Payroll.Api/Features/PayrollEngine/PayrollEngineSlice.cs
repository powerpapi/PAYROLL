using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;
using Payroll.Api.Features.StatutoryAndTax;

namespace Payroll.Api.Features.PayrollEngine;

public static class PayrollEngineSlice
{
    public record CreatePayrollPeriodRequest(
        string Code,
        string Name,
        string PayFrequency, // SemiMonthly, Monthly, Weekly
        int CutoffSlot,      // 1 or 2
        DateOnly StartDate,
        DateOnly EndDate,
        DateOnly PayDate);

    public class CreatePayrollPeriodValidator : AbstractValidator<CreatePayrollPeriodRequest>
    {
        public CreatePayrollPeriodValidator()
        {
            RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
            RuleFor(x => x.Name).NotEmpty().MaximumLength(128);
            RuleFor(x => x.PayFrequency).Must(f => f is "SemiMonthly" or "Monthly" or "Weekly");
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate);
        }
    }

    public static void MapPayrollEngineEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/payroll/periods")
            .WithTags("Phase 3: Payroll Calculation Engine")
            .RequireAuthorization();

        // List all Payroll Periods with aggregated totals
        group.MapGet("/", async (AppDbContext db) =>
        {
            var periods = await db.PayrollPeriods
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
                    p.FinalizedAtUtc,
                    EmployeeCount = p.Items.Count,
                    TotalGrossPay = p.Items.Sum(i => (decimal?)i.GrossPay) ?? 0m,
                    TotalDeductions = p.Items.Sum(i => (decimal?)(i.TotalEmployeeContributions + i.WithholdingTax)) ?? 0m,
                    TotalNetPay = p.Items.Sum(i => (decimal?)i.NetPay) ?? 0m
                })
                .ToListAsync();

            return Results.Ok(periods);
        });

        // Create a new Payroll Period
        group.MapPost("/", async (
            CreatePayrollPeriodRequest request,
            IValidator<CreatePayrollPeriodRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var code = request.Code.Trim().ToUpperInvariant();
            if (await db.PayrollPeriods.AnyAsync(p => p.Code == code))
                return Results.Conflict(new { message = $"Payroll period '{code}' already exists." });

            var period = new PayrollPeriod
            {
                Code = code,
                Name = request.Name.Trim(),
                PayFrequency = request.PayFrequency,
                CutoffSlot = request.CutoffSlot,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                PayDate = request.PayDate,
                Status = "Draft"
            };

            db.PayrollPeriods.Add(period);
            await db.SaveChangesAsync();

            return Results.Created($"/api/payroll/periods/{period.Id}", new { period.Id, period.Code, period.Status });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // Get detailed Payroll Register & itemized line breakdown for a specific period
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Where(p => p.Id == id)
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
                    p.FinalizedAtUtc,
                    Items = p.Items
                        .OrderBy(i => i.Employee!.LastName)
                        .Select(i => new
                        {
                            i.Id,
                            i.EmployeeId,
                            EmployeeCode = i.Employee != null ? i.Employee.EmployeeCode : "",
                            EmployeeName = i.Employee != null ? i.Employee.LastName + ", " + i.Employee.FirstName : "",
                            JobTitle = i.Employee != null ? i.Employee.JobTitle : "",
                            DepartmentName = i.Employee != null && i.Employee.Department != null ? i.Employee.Department.Name : "",
                            i.DaysWorked,
                            i.AbsentDays,
                            i.LateUndertimeMinutes,
                            i.OvertimeHours,
                            i.BasicPay,
                            i.AbsenceDeduction,
                            i.LateUndertimeDeduction,
                            i.OvertimePay,
                            i.HolidayPay,
                            i.TaxableAllowances,
                            i.NonTaxableAllowances,
                            i.GrossPay,
                            i.TotalEmployeeContributions,
                            i.TotalEmployerContributions,
                            i.TaxableIncome,
                            i.WithholdingTax,
                            i.NetPay,
                            Lines = i.Lines.OrderBy(l => l.LineType).ThenBy(l => l.Code).Select(l => new
                            {
                                l.Id,
                                l.LineType,
                                l.Code,
                                l.Description,
                                l.Amount,
                                l.EmployerAmount
                            }).ToList()
                        }).ToList()
                })
                .FirstOrDefaultAsync();

            return period is not null ? Results.Ok(period) : Results.NotFound();
        });

        // ====================================================================
        // EXECUTE PAYROLL CALCULATION ENGINE FOR A PAY PERIOD
        // ====================================================================
        group.MapPost("/{id:guid}/compute", async (Guid id, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (period is null)
                return Results.NotFound();

            if (period.Status == "Finalized")
                return Results.BadRequest(new { message = "Finalized payroll periods are locked and cannot be recomputed." });

            var divisor = period.PayFrequency switch
            {
                "Monthly" => 1m,
                "Weekly" => 4m,
                _ => 2m
            };

            // 1. Load active employees matching this PayFrequency
            var employees = await db.Employees
                .Where(e => e.IsActive && e.PayFrequency == period.PayFrequency)
                .ToListAsync();

            // 2. Load Phase 2 Attendance, Unpaid Leaves & Approved Overtime in period range
            var attendanceLogs = await db.AttendanceLogs
                .Where(a => a.WorkDate >= period.StartDate && a.WorkDate <= period.EndDate)
                .ToListAsync();

            var unpaidLeaves = await db.LeaveRequests
                .Include(lr => lr.LeaveType)
                .Where(lr =>
                    lr.Status == "Approved" &&
                    lr.LeaveType != null && !lr.LeaveType.IsPaid &&
                    lr.StartDate <= period.EndDate && lr.EndDate >= period.StartDate)
                .ToListAsync();

            var approvedOvertimes = await db.OvertimeRequests
                .Where(ot =>
                    ot.Status == "Approved" &&
                    ot.WorkDate >= period.StartDate && ot.WorkDate <= period.EndDate)
                .ToListAsync();

            // 3. Load Phase 3 Active Employee Allowances
            var allowances = await db.EmployeeAllowances
                .Where(ea => ea.IsActive)
                .ToListAsync();

            // 4. Load Phase 4 Active Dynamic Government Contributions & Dynamic Tax Brackets
            var contributionTypes = await db.ContributionTypes
                .Where(c => c.IsActive)
                .Include(c => c.Schedules)
                .ThenInclude(s => s.Brackets)
                .ToListAsync();

            var taxBrackets = await db.TaxBrackets
                .AsNoTracking()
                .Where(tb => tb.EffectiveFrom <= period.EndDate && (!tb.EffectiveTo.HasValue || tb.EffectiveTo >= period.EndDate))
                .OrderBy(tb => tb.MinMonthlyIncome)
                .ToListAsync();

            if (period.Items.Count > 0)
            {
                db.PayrollItems.RemoveRange(period.Items);
                await db.SaveChangesAsync();
            }

            var newItems = new List<PayrollItem>();

            foreach (var emp in employees)
            {
                var lines = new List<PayrollItemLine>();

                // A. Basic Pay for the cutoff
                var basicPay = Math.Round(emp.BasicMonthlySalary / divisor, 2);
                lines.Add(new PayrollItemLine
                {
                    LineType = "Earning",
                    Code = "BASIC",
                    Description = $"Basic Salary ({period.PayFrequency})",
                    Amount = basicPay
                });

                // B. Attendance: Absences, Worked Holidays & Late/Undertime Deductions
                var empAtt = attendanceLogs.Where(a => a.EmployeeId == emp.Id).ToList();
                var daysWorked = empAtt.Count(a => a.Status is "Present" or "Late" or "Holiday");
                var absentDaysFromLogs = empAtt.Count(a => a.Status == "Absent");

                var unpaidLeaveDays = (int)unpaidLeaves
                    .Where(ul => ul.EmployeeId == emp.Id)
                    .Sum(ul => ul.TotalDays);

                var totalAbsentDays = absentDaysFromLogs + unpaidLeaveDays;
                var absenceDeduction = Math.Round(totalAbsentDays * emp.DailyRate, 2);
                if (absenceDeduction > 0)
                {
                    lines.Add(new PayrollItemLine
                    {
                        LineType = "AttendanceDeduction",
                        Code = "ABSENCE",
                        Description = $"Absences / LWOP ({totalAbsentDays} day(s))",
                        Amount = -absenceDeduction
                    });
                }

                var lateUtMins = empAtt.Sum(a => a.LateMinutes + a.UndertimeMinutes);
                var perMinuteRate = emp.HourlyRate / 60m;
                var lateUtDeduction = Math.Round(lateUtMins * perMinuteRate, 2);
                if (lateUtDeduction > 0)
                {
                    lines.Add(new PayrollItemLine
                    {
                        LineType = "AttendanceDeduction",
                        Code = "LATE_UT",
                        Description = $"Late & Undertime ({lateUtMins} mins)",
                        Amount = -lateUtDeduction
                    });
                }

                // Worked Holiday Premium (+100% Daily Rate for worked holidays)
                var workedHolidayDays = empAtt.Count(a => a.Status == "Holiday" && a.HoursWorked > 0);
                var holidayPay = Math.Round(workedHolidayDays * emp.DailyRate, 2);
                if (holidayPay > 0)
                {
                    lines.Add(new PayrollItemLine
                    {
                        LineType = "Earning",
                        Code = "HOLIDAY",
                        Description = $"Worked Holiday Pay Premium ({workedHolidayDays} day(s))",
                        Amount = holidayPay
                    });
                }

                // C. Approved Overtime Pay
                var empOts = approvedOvertimes.Where(o => o.EmployeeId == emp.Id).ToList();
                var otHours = empOts.Sum(o => o.Hours);
                var otPay = Math.Round(empOts.Sum(o => o.ComputedAmount), 2);
                if (otPay > 0)
                {
                    lines.Add(new PayrollItemLine
                    {
                        LineType = "Earning",
                        Code = "OVERTIME",
                        Description = $"Approved Overtime ({otHours:0.##} hrs)",
                        Amount = otPay
                    });
                }

                // D. Taxable & Non-Taxable (De Minimis) Allowances
                var empAllowances = allowances.Where(a => a.EmployeeId == emp.Id).ToList();
                decimal taxableAllowanceTotal = 0m;
                decimal nonTaxableAllowanceTotal = 0m;

                foreach (var alw in empAllowances)
                {
                    var cutoffAmount = alw.Frequency == "Monthly"
                        ? Math.Round(alw.Amount / divisor, 2)
                        : Math.Round(alw.Amount, 2);

                    if (alw.IsTaxable)
                        taxableAllowanceTotal += cutoffAmount;
                    else
                        nonTaxableAllowanceTotal += cutoffAmount;

                    lines.Add(new PayrollItemLine
                    {
                        LineType = "Earning",
                        Code = alw.IsTaxable ? "ALW_TAX" : "ALW_DEMINIMIS",
                        Description = $"{alw.Name} ({(alw.IsTaxable ? "Taxable" : "De Minimis")})",
                        Amount = cutoffAmount
                    });
                }

                // E. Gross Pay
                var grossPay = Math.Max(
                    0m,
                    basicPay - absenceDeduction - lateUtDeduction + holidayPay + otPay + taxableAllowanceTotal + nonTaxableAllowanceTotal);

                // F. Dynamic Government Contributions (SSS, PhilHealth, Pag-IBIG + Custom)
                decimal totalEeContrib = 0m;
                decimal totalErContrib = 0m;
                decimal taxDeductibleEeContrib = 0m;

                foreach (var cType in contributionTypes)
                {
                    var activeSchedule = cType.Schedules
                        .Where(s => s.EffectiveFrom <= period.EndDate && (!s.EffectiveTo.HasValue || s.EffectiveTo >= period.EndDate))
                        .OrderByDescending(s => s.EffectiveFrom)
                        .FirstOrDefault();

                    if (activeSchedule is null) continue;

                    var monthlyEval = ContributionSlices.EvaluateSchedule(cType, activeSchedule, emp.BasicMonthlySalary);
                    var eeShare = Math.Round(monthlyEval.EmployeeShare / divisor, 2);
                    var erShare = Math.Round((monthlyEval.EmployerShare + monthlyEval.EmployerEcShare) / divisor, 2);

                    totalEeContrib += eeShare;
                    totalErContrib += erShare;
                    if (cType.IsTaxDeductible)
                        taxDeductibleEeContrib += eeShare;

                    lines.Add(new PayrollItemLine
                    {
                        LineType = "Contribution",
                        Code = cType.Code,
                        Description = $"{cType.Name} Employee Share",
                        Amount = -eeShare,
                        EmployerAmount = erShare
                    });
                }

                // G. Dynamic Taxable Income & Withholding Tax (Evaluated from DB TaxBrackets)
                var taxableIncome = Math.Max(
                    0m,
                    basicPay - absenceDeduction - lateUtDeduction + holidayPay + otPay + taxableAllowanceTotal - taxDeductibleEeContrib);

                var monthlyEquivalentTaxable = taxableIncome * divisor;
                var (monthlyTax, matchedBracketName, _) = ContributionSlices.EvaluateTaxBrackets(taxBrackets, monthlyEquivalentTaxable);
                var withholdingTax = Math.Round(monthlyTax / divisor, 2);

                if (withholdingTax > 0)
                {
                    lines.Add(new PayrollItemLine
                    {
                        LineType = "Tax",
                        Code = "WTAX",
                        Description = $"Withholding Tax ({matchedBracketName})",
                        Amount = -withholdingTax
                    });
                }

                // H. Final Net Pay
                var netPay = Math.Max(0m, grossPay - totalEeContrib - withholdingTax);

                newItems.Add(new PayrollItem
                {
                    PayrollPeriodId = period.Id,
                    EmployeeId = emp.Id,
                    DaysWorked = daysWorked,
                    AbsentDays = totalAbsentDays,
                    LateUndertimeMinutes = lateUtMins,
                    OvertimeHours = otHours,
                    BasicPay = basicPay,
                    AbsenceDeduction = absenceDeduction,
                    LateUndertimeDeduction = lateUtDeduction,
                    OvertimePay = otPay,
                    HolidayPay = holidayPay,
                    TaxableAllowances = taxableAllowanceTotal,
                    NonTaxableAllowances = nonTaxableAllowanceTotal,
                    GrossPay = grossPay,
                    TotalEmployeeContributions = totalEeContrib,
                    TotalEmployerContributions = totalErContrib,
                    TaxableIncome = taxableIncome,
                    WithholdingTax = withholdingTax,
                    NetPay = netPay,
                    Lines = lines
                });
            }

            db.PayrollItems.AddRange(newItems);
            period.Status = "Computed";
            period.ComputedAtUtc = DateTime.UtcNow;

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Status,
                period.ComputedAtUtc,
                ProcessedEmployees = newItems.Count,
                TotalGrossPay = newItems.Sum(i => i.GrossPay),
                TotalNetPay = newItems.Sum(i => i.NetPay)
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);
    }
}
