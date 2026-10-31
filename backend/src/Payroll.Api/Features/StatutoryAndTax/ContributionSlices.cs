using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.StatutoryAndTax;

/// <summary>
/// Vertical Slice for Dynamic Government Contributions (SSS, PhilHealth, Pag-IBIG + custom contributions).
/// Supports adding new statutory contribution types and computing deductions dynamically by effective date.
/// </summary>
public static class ContributionSlices
{
    public record CreateContributionTypeRequest(
        string Code,
        string Name,
        string? Description,
        bool IsTaxDeductible,
        DateOnly EffectiveFrom,
        ContributionCalculationMode CalculationMode,
        decimal EmployeeRatePercent,
        decimal EmployerRatePercent,
        decimal FixedEmployeeAmount,
        decimal FixedEmployerAmount,
        decimal? SalaryFloor,
        decimal? SalaryCeiling);

    public record ContributionLineResult(
        string Code,
        string Name,
        decimal EmployeeShare,
        decimal EmployerShare,
        decimal EmployerEcShare);

    /// <summary>
    /// Pure Domain Calculator: computes an employee's share and employer's share for any active
    /// ContributionSchedule (whether Percentage with Floor/Ceiling, FixedAmount, or BracketTable).
    /// </summary>
    public static ContributionLineResult EvaluateSchedule(
        ContributionType type,
        ContributionSchedule schedule,
        decimal monthlyBasicSalary)
    {
        return schedule.CalculationMode switch
        {
            ContributionCalculationMode.FixedAmount => new ContributionLineResult(
                type.Code,
                type.Name,
                Math.Round(schedule.FixedEmployeeAmount, 2),
                Math.Round(schedule.FixedEmployerAmount, 2),
                0m),

            ContributionCalculationMode.Percentage => ComputePercentage(type, schedule, monthlyBasicSalary),

            ContributionCalculationMode.BracketTable => ComputeBracket(type, schedule, monthlyBasicSalary),

            _ => new ContributionLineResult(type.Code, type.Name, 0m, 0m, 0m)
        };
    }

    private static ContributionLineResult ComputePercentage(
        ContributionType type,
        ContributionSchedule schedule,
        decimal salary)
    {
        var basis = salary;
        if (schedule.SalaryFloor.HasValue && basis < schedule.SalaryFloor.Value)
            basis = schedule.SalaryFloor.Value;
        if (schedule.SalaryCeiling.HasValue && basis > schedule.SalaryCeiling.Value)
            basis = schedule.SalaryCeiling.Value;

        var ee = Math.Round(basis * (schedule.EmployeeRatePercent / 100m), 2);
        var er = Math.Round(basis * (schedule.EmployerRatePercent / 100m), 2);
        return new ContributionLineResult(type.Code, type.Name, ee, er, 0m);
    }

    private static ContributionLineResult ComputeBracket(
        ContributionType type,
        ContributionSchedule schedule,
        decimal salary)
    {
        var bracket = schedule.Brackets
            .OrderBy(b => b.MinCompensation)
            .FirstOrDefault(b =>
                salary >= b.MinCompensation &&
                (!b.MaxCompensation.HasValue || salary <= b.MaxCompensation.Value));

        if (bracket is null)
            return new ContributionLineResult(type.Code, type.Name, 0m, 0m, 0m);

        return new ContributionLineResult(
            type.Code,
            type.Name,
            Math.Round(bracket.EmployeeShare, 2),
            Math.Round(bracket.EmployerShare, 2),
            Math.Round(bracket.EmployerEcShare, 2));
    }

    public static void MapContributionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/contributions")
            .WithTags("Phase 4: Dynamic Government Contributions");

        // List all configured government contributions (default SSS, PhilHealth, Pag-IBIG + custom ones)
        group.MapGet("/", async (AppDbContext db) =>
        {
            var items = await db.ContributionTypes
                .AsNoTracking()
                .Include(c => c.Schedules)
                .ThenInclude(s => s.Brackets)
                .OrderByDescending(c => c.IsSystemDefault)
                .ThenBy(c => c.Code)
                .ToListAsync();

            return Results.Ok(items);
        });

        // Dynamically add a new Government Contribution Type & initial Schedule without code changes
        group.MapPost("/", async (CreateContributionTypeRequest req, AppDbContext db) =>
        {
            var code = req.Code.Trim().ToUpperInvariant();
            if (await db.ContributionTypes.AnyAsync(c => c.Code == code))
                return Results.Conflict(new { message = $"Contribution type '{code}' already exists." });

            var type = new ContributionType
            {
                Code = code,
                Name = req.Name,
                Description = req.Description,
                IsSystemDefault = false,
                IsTaxDeductible = req.IsTaxDeductible,
                Schedules =
                [
                    new ContributionSchedule
                    {
                        EffectiveFrom = req.EffectiveFrom,
                        CalculationMode = req.CalculationMode,
                        EmployeeRatePercent = req.EmployeeRatePercent,
                        EmployerRatePercent = req.EmployerRatePercent,
                        FixedEmployeeAmount = req.FixedEmployeeAmount,
                        FixedEmployerAmount = req.FixedEmployerAmount,
                        SalaryFloor = req.SalaryFloor,
                        SalaryCeiling = req.SalaryCeiling
                    }
                ]
            };

            db.ContributionTypes.Add(type);
            await db.SaveChangesAsync();
            return Results.Created($"/api/contributions/{type.Id}", type);
        }).RequireAuthorization();

        // Simulate/preview dynamic contributions for any given Monthly Salary and Date
        group.MapGet("/preview", async (decimal monthlySalary, DateOnly? asOfDate, AppDbContext db) =>
        {
            var targetDate = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var types = await db.ContributionTypes
                .AsNoTracking()
                .Where(c => c.IsActive)
                .Include(c => c.Schedules)
                .ThenInclude(s => s.Brackets)
                .ToListAsync();

            var breakdown = new List<ContributionLineResult>();
            foreach (var type in types)
            {
                var activeSchedule = type.Schedules
                    .Where(s => s.EffectiveFrom <= targetDate && (!s.EffectiveTo.HasValue || s.EffectiveTo >= targetDate))
                    .OrderByDescending(s => s.EffectiveFrom)
                    .FirstOrDefault();

                if (activeSchedule is not null)
                {
                    breakdown.Add(EvaluateSchedule(type, activeSchedule, monthlySalary));
                }
            }

            return Results.Ok(new
            {
                MonthlySalary = monthlySalary,
                AsOfDate = targetDate,
                TotalEmployeeShare = breakdown.Sum(b => b.EmployeeShare),
                TotalEmployerShare = breakdown.Sum(b => b.EmployerShare + b.EmployerEcShare),
                Contributions = breakdown
            });
        });
    }
}
