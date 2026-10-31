using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.StatutoryAndTax;

/// <summary>
/// Pure, deterministic mathematical formula evaluator for government contribution formulas.
/// Supports variables: salary, basis, floor, ceiling, ee_rate, er_rate, fixed_ee, fixed_er
/// Supports functions: min(a, b), max(a, b), clamp(x, min, max), round(x)
/// Supports operators: +, -, *, /, and parentheses ( )
/// </summary>
public static class ContributionFormulaEvaluator
{
    public static decimal Evaluate(string? formula, IReadOnlyDictionary<string, decimal> variables)
    {
        if (string.IsNullOrWhiteSpace(formula))
            return 0m;

        var parser = new ExpressionParser(formula, variables);
        var result = parser.ParseExpression();
        parser.ExpectEnd();
        return Math.Max(0m, Math.Round(result, 2));
    }

    private sealed class ExpressionParser(string text, IReadOnlyDictionary<string, decimal> vars)
    {
        private int _pos;

        public void ExpectEnd()
        {
            SkipWhitespace();
            if (_pos < text.Length)
                throw new FormatException($"Unexpected character '{text[_pos]}' at position {_pos}.");
        }

        public decimal ParseExpression()
        {
            var left = ParseTerm();
            while (true)
            {
                SkipWhitespace();
                if (Match('+'))
                    left += ParseTerm();
                else if (Match('-'))
                    left -= ParseTerm();
                else
                    break;
            }
            return left;
        }

        private decimal ParseTerm()
        {
            var left = ParseFactor();
            while (true)
            {
                SkipWhitespace();
                if (Match('*'))
                    left *= ParseFactor();
                else if (Match('/'))
                {
                    var right = ParseFactor();
                    left = right == 0m ? 0m : left / right;
                }
                else
                    break;
            }
            return left;
        }

        private decimal ParseFactor()
        {
            SkipWhitespace();
            if (Match('+')) return ParseFactor();
            if (Match('-')) return -ParseFactor();

            if (Match('('))
            {
                var val = ParseExpression();
                SkipWhitespace();
                if (!Match(')'))
                    throw new FormatException("Missing closing parenthesis ')'.");
                return val;
            }

            // Number literal
            if (_pos < text.Length && (char.IsDigit(text[_pos]) || text[_pos] == '.'))
            {
                var start = _pos;
                while (_pos < text.Length && (char.IsDigit(text[_pos]) || text[_pos] == '.'))
                    _pos++;

                var token = text[start.._pos];
                if (!decimal.TryParse(token, NumberStyles.Number, CultureInfo.InvariantCulture, out var num))
                    throw new FormatException($"Invalid number '{token}'.");
                return num;
            }

            // Identifier (Variable or Function call)
            if (_pos < text.Length && (char.IsLetter(text[_pos]) || text[_pos] == '_'))
            {
                var start = _pos;
                while (_pos < text.Length && (char.IsLetterOrDigit(text[_pos]) || text[_pos] == '_'))
                    _pos++;

                var ident = text[start.._pos].ToLowerInvariant();
                SkipWhitespace();

                // Function call: min(...), max(...), clamp(...), round(...)
                if (Match('('))
                {
                    var args = new List<decimal>();
                    SkipWhitespace();
                    if (!Match(')'))
                    {
                        while (true)
                        {
                            args.Add(ParseExpression());
                            SkipWhitespace();
                            if (Match(')')) break;
                            if (!Match(','))
                                throw new FormatException($"Expected ',' or ')' in function '{ident}'.");
                        }
                    }

                    return ident switch
                    {
                        "min" when args.Count == 2 => Math.Min(args[0], args[1]),
                        "max" when args.Count == 2 => Math.Max(args[0], args[1]),
                        "clamp" when args.Count == 3 => Math.Clamp(args[0], args[1], args[2]),
                        "round" when args.Count == 1 => Math.Round(args[0], 2),
                        _ => throw new FormatException($"Unknown function or invalid argument count for '{ident}'.")
                    };
                }

                // Variable lookup
                if (vars.TryGetValue(ident, out var value))
                    return value;

                throw new FormatException($"Unknown formula variable '{ident}'. Allowed: {string.Join(", ", vars.Keys)}");
            }

            throw new FormatException($"Unexpected token in formula at position {_pos}.");
        }

        private void SkipWhitespace()
        {
            while (_pos < text.Length && char.IsWhiteSpace(text[_pos]))
                _pos++;
        }

        private bool Match(char expected)
        {
            if (_pos < text.Length && text[_pos] == expected)
            {
                _pos++;
                return true;
            }
            return false;
        }
    }
}

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
        decimal? SalaryCeiling,
        string? EmployeeFormula,
        string? EmployerFormula);

    public record BracketDto(
        decimal MinCompensation,
        decimal? MaxCompensation,
        decimal MonthlySalaryCredit,
        decimal EmployeeShare,
        decimal EmployerShare,
        decimal EmployerEcShare);

    public record UpdateScheduleRequest(
        ContributionCalculationMode CalculationMode,
        decimal EmployeeRatePercent,
        decimal EmployerRatePercent,
        decimal FixedEmployeeAmount,
        decimal FixedEmployerAmount,
        decimal? SalaryFloor,
        decimal? SalaryCeiling,
        string? EmployeeFormula,
        string? EmployerFormula,
        List<BracketDto>? Brackets);

    public record TestFormulaRequest(
        decimal MonthlySalary,
        decimal EmployeeRatePercent,
        decimal EmployerRatePercent,
        decimal FixedEmployeeAmount,
        decimal FixedEmployerAmount,
        decimal? SalaryFloor,
        decimal? SalaryCeiling,
        string EmployeeFormula,
        string EmployerFormula);

    public record ContributionLineResult(
        string Code,
        string Name,
        string FormulaSummary,
        decimal EmployeeShare,
        decimal EmployerShare,
        decimal EmployerEcShare);

    public record SaveTaxBracketRequest(
        string BracketName,
        DateOnly EffectiveFrom,
        decimal MinMonthlyIncome,
        decimal? MaxMonthlyIncome,
        decimal BaseTax,
        decimal ExcessOverAmount,
        decimal ExcessRatePercent,
        string? TaxFormula);

    /// <summary>
    /// Evaluates Monthly Withholding Tax dynamically from the database TaxBrackets
    /// using either each bracket's custom TaxFormula or standard BaseTax + Excess * Rate%.
    /// </summary>
    public static (decimal MonthlyTax, string MatchedBracketName, string AppliedFormula) EvaluateTaxBrackets(
        IEnumerable<TaxBracket> brackets,
        decimal monthlyTaxableIncome)
    {
        var bracket = brackets
            .OrderBy(b => b.MinMonthlyIncome)
            .FirstOrDefault(b =>
                monthlyTaxableIncome >= b.MinMonthlyIncome &&
                (!b.MaxMonthlyIncome.HasValue || monthlyTaxableIncome <= b.MaxMonthlyIncome.Value));

        if (bracket is null)
            return (0m, "Tax Exempt", "0");

        var formula = string.IsNullOrWhiteSpace(bracket.TaxFormula)
            ? "base_tax + max(0, taxable - excess_over) * (rate / 100)"
            : bracket.TaxFormula;

        var vars = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["taxable"] = monthlyTaxableIncome,
            ["salary"] = monthlyTaxableIncome,
            ["min_income"] = bracket.MinMonthlyIncome,
            ["base_tax"] = bracket.BaseTax,
            ["excess_over"] = bracket.ExcessOverAmount,
            ["rate"] = bracket.ExcessRatePercent
        };

        var computed = ContributionFormulaEvaluator.Evaluate(formula, vars);
        return (computed, bracket.BracketName, formula);
    }

    public static IReadOnlyDictionary<string, decimal> BuildFormulaVariables(
        ContributionSchedule schedule,
        decimal monthlyBasicSalary)
    {
        var floor = schedule.SalaryFloor ?? 0m;
        var ceiling = schedule.SalaryCeiling ?? monthlyBasicSalary;
        var basis = monthlyBasicSalary;
        if (schedule.SalaryFloor.HasValue && basis < schedule.SalaryFloor.Value)
            basis = schedule.SalaryFloor.Value;
        if (schedule.SalaryCeiling.HasValue && basis > schedule.SalaryCeiling.Value)
            basis = schedule.SalaryCeiling.Value;

        return new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["salary"] = monthlyBasicSalary,
            ["basis"] = basis,
            ["floor"] = floor,
            ["ceiling"] = ceiling,
            ["ee_rate"] = schedule.EmployeeRatePercent,
            ["er_rate"] = schedule.EmployerRatePercent,
            ["fixed_ee"] = schedule.FixedEmployeeAmount,
            ["fixed_er"] = schedule.FixedEmployerAmount
        };
    }

    /// <summary>
    /// Pure Domain Calculator: computes an employee's share and employer's share for any active
    /// ContributionSchedule (FixedAmount, Percentage, BracketTable, or custom FormulaExpression).
    /// </summary>
    public static ContributionLineResult EvaluateSchedule(
        ContributionType type,
        ContributionSchedule schedule,
        decimal monthlyBasicSalary)
    {
        return schedule.CalculationMode switch
        {
            ContributionCalculationMode.FormulaExpression => ComputeFormula(type, schedule, monthlyBasicSalary),

            ContributionCalculationMode.FixedAmount => new ContributionLineResult(
                type.Code,
                type.Name,
                $"Fixed: EE ₱{schedule.FixedEmployeeAmount:N2} / ER ₱{schedule.FixedEmployerAmount:N2}",
                Math.Round(schedule.FixedEmployeeAmount, 2),
                Math.Round(schedule.FixedEmployerAmount, 2),
                0m),

            ContributionCalculationMode.Percentage => !string.IsNullOrWhiteSpace(schedule.EmployeeFormula)
                ? ComputeFormula(type, schedule, monthlyBasicSalary)
                : ComputePercentage(type, schedule, monthlyBasicSalary),

            ContributionCalculationMode.BracketTable => ComputeBracket(type, schedule, monthlyBasicSalary),

            _ => new ContributionLineResult(type.Code, type.Name, "N/A", 0m, 0m, 0m)
        };
    }

    private static ContributionLineResult ComputeFormula(
        ContributionType type,
        ContributionSchedule schedule,
        decimal salary)
    {
        var vars = BuildFormulaVariables(schedule, salary);
        var eeFormula = string.IsNullOrWhiteSpace(schedule.EmployeeFormula)
            ? "basis * (ee_rate / 100)"
            : schedule.EmployeeFormula;
        var erFormula = string.IsNullOrWhiteSpace(schedule.EmployerFormula)
            ? "basis * (er_rate / 100)"
            : schedule.EmployerFormula;

        var ee = ContributionFormulaEvaluator.Evaluate(eeFormula, vars);
        var er = ContributionFormulaEvaluator.Evaluate(erFormula, vars);

        return new ContributionLineResult(
            type.Code,
            type.Name,
            $"EE: {eeFormula} | ER: {erFormula}",
            ee,
            er,
            0m);
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
        return new ContributionLineResult(
            type.Code,
            type.Name,
            $"Percentage: {schedule.EmployeeRatePercent}% EE / {schedule.EmployerRatePercent}% ER",
            ee,
            er,
            0m);
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
            return new ContributionLineResult(type.Code, type.Name, "Bracket Table (No match)", 0m, 0m, 0m);

        return new ContributionLineResult(
            type.Code,
            type.Name,
            $"Bracket [{bracket.MinCompensation:N0} – {(bracket.MaxCompensation.HasValue ? bracket.MaxCompensation.Value.ToString("N0") : "Above")}]",
            Math.Round(bracket.EmployeeShare, 2),
            Math.Round(bracket.EmployerShare, 2),
            Math.Round(bracket.EmployerEcShare, 2));
    }

    public static void MapContributionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/contributions")
            .WithTags("Phase 4: Dynamic Government Contributions");

        // List all configured government contributions & their active schedules/formulas
        group.MapGet("/", async (AppDbContext db) =>
        {
            var items = await db.ContributionTypes
                .AsNoTracking()
                .Include(c => c.Schedules)
                .ThenInclude(s => s.Brackets.OrderBy(b => b.MinCompensation))
                .OrderByDescending(c => c.IsSystemDefault)
                .ThenBy(c => c.Code)
                .Select(c => new
                {
                    c.Id,
                    c.Code,
                    c.Name,
                    c.Description,
                    c.IsSystemDefault,
                    c.IsActive,
                    c.IsTaxDeductible,
                    Schedules = c.Schedules.OrderByDescending(s => s.EffectiveFrom).Select(s => new
                    {
                        s.Id,
                        s.EffectiveFrom,
                        s.EffectiveTo,
                        s.CalculationMode,
                        s.EmployeeRatePercent,
                        s.EmployerRatePercent,
                        s.FixedEmployeeAmount,
                        s.FixedEmployerAmount,
                        s.SalaryFloor,
                        s.SalaryCeiling,
                        s.EmployeeFormula,
                        s.EmployerFormula,
                        Brackets = s.Brackets.OrderBy(b => b.MinCompensation).Select(b => new
                        {
                            b.Id,
                            b.MinCompensation,
                            b.MaxCompensation,
                            b.MonthlySalaryCredit,
                            b.EmployeeShare,
                            b.EmployerShare,
                            b.EmployerEcShare
                        }).ToList()
                    }).ToList()
                })
                .ToListAsync();

            return Results.Ok(items);
        });

        // Dynamically add a new Government Contribution Type & initial Schedule/Formula
        group.MapPost("/", async (CreateContributionTypeRequest req, AppDbContext db) =>
        {
            var code = req.Code.Trim().ToUpperInvariant();
            if (await db.ContributionTypes.AnyAsync(c => c.Code == code))
                return Results.Conflict(new { message = $"Contribution type '{code}' already exists." });

            var schedule = new ContributionSchedule
            {
                EffectiveFrom = req.EffectiveFrom,
                CalculationMode = req.CalculationMode,
                EmployeeRatePercent = req.EmployeeRatePercent,
                EmployerRatePercent = req.EmployerRatePercent,
                FixedEmployeeAmount = req.FixedEmployeeAmount,
                FixedEmployerAmount = req.FixedEmployerAmount,
                SalaryFloor = req.SalaryFloor,
                SalaryCeiling = req.SalaryCeiling,
                EmployeeFormula = req.EmployeeFormula,
                EmployerFormula = req.EmployerFormula
            };

            // Validate formula syntax before saving if FormulaExpression mode is selected
            if (schedule.CalculationMode == ContributionCalculationMode.FormulaExpression ||
                !string.IsNullOrWhiteSpace(schedule.EmployeeFormula) ||
                !string.IsNullOrWhiteSpace(schedule.EmployerFormula))
            {
                try
                {
                    var testVars = BuildFormulaVariables(schedule, 25000m);
                    if (!string.IsNullOrWhiteSpace(schedule.EmployeeFormula))
                        ContributionFormulaEvaluator.Evaluate(schedule.EmployeeFormula, testVars);
                    if (!string.IsNullOrWhiteSpace(schedule.EmployerFormula))
                        ContributionFormulaEvaluator.Evaluate(schedule.EmployerFormula, testVars);
                }
                catch (FormatException ex)
                {
                    return Results.BadRequest(new { message = $"Formula syntax error: {ex.Message}" });
                }
            }

            var type = new ContributionType
            {
                Code = code,
                Name = req.Name.Trim(),
                Description = req.Description,
                IsSystemDefault = false,
                IsTaxDeductible = req.IsTaxDeductible,
                Schedules = [schedule]
            };

            db.ContributionTypes.Add(type);
            await db.SaveChangesAsync();
            return Results.Created($"/api/contributions/{type.Id}", new { type.Id, type.Code, type.Name });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // Update an existing ContributionSchedule's Formula, Rates, Floor/Ceiling, or Brackets
        group.MapPut("/schedules/{scheduleId:guid}", async (
            Guid scheduleId,
            UpdateScheduleRequest req,
            AppDbContext db) =>
        {
            var schedule = await db.ContributionSchedules
                .Include(s => s.Brackets)
                .FirstOrDefaultAsync(s => s.Id == scheduleId);

            if (schedule is null)
                return Results.NotFound();

            schedule.CalculationMode = req.CalculationMode;
            schedule.EmployeeRatePercent = req.EmployeeRatePercent;
            schedule.EmployerRatePercent = req.EmployerRatePercent;
            schedule.FixedEmployeeAmount = req.FixedEmployeeAmount;
            schedule.FixedEmployerAmount = req.FixedEmployerAmount;
            schedule.SalaryFloor = req.SalaryFloor;
            schedule.SalaryCeiling = req.SalaryCeiling;
            schedule.EmployeeFormula = req.EmployeeFormula?.Trim();
            schedule.EmployerFormula = req.EmployerFormula?.Trim();

            // Validate custom formulas if provided
            if (schedule.CalculationMode == ContributionCalculationMode.FormulaExpression ||
                !string.IsNullOrWhiteSpace(schedule.EmployeeFormula) ||
                !string.IsNullOrWhiteSpace(schedule.EmployerFormula))
            {
                try
                {
                    var testVars = BuildFormulaVariables(schedule, 25000m);
                    if (!string.IsNullOrWhiteSpace(schedule.EmployeeFormula))
                        ContributionFormulaEvaluator.Evaluate(schedule.EmployeeFormula, testVars);
                    if (!string.IsNullOrWhiteSpace(schedule.EmployerFormula))
                        ContributionFormulaEvaluator.Evaluate(schedule.EmployerFormula, testVars);
                }
                catch (FormatException ex)
                {
                    return Results.BadRequest(new { message = $"Formula syntax error: {ex.Message}" });
                }
            }

            // Replace brackets if BracketTable mode and brackets were supplied
            if (req.CalculationMode == ContributionCalculationMode.BracketTable && req.Brackets is not null)
            {
                db.ContributionBrackets.RemoveRange(schedule.Brackets);
                schedule.Brackets = req.Brackets.Select(b => new ContributionBracket
                {
                    ContributionScheduleId = schedule.Id,
                    MinCompensation = b.MinCompensation,
                    MaxCompensation = b.MaxCompensation,
                    MonthlySalaryCredit = b.MonthlySalaryCredit,
                    EmployeeShare = b.EmployeeShare,
                    EmployerShare = b.EmployerShare,
                    EmployerEcShare = b.EmployerEcShare
                }).ToList();
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { schedule.Id, schedule.CalculationMode, schedule.EmployeeFormula, schedule.EmployerFormula });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // Live Formula Tester Endpoint
        group.MapPost("/test-formula", (TestFormulaRequest req) =>
        {
            var tempSchedule = new ContributionSchedule
            {
                CalculationMode = ContributionCalculationMode.FormulaExpression,
                EmployeeRatePercent = req.EmployeeRatePercent,
                EmployerRatePercent = req.EmployerRatePercent,
                FixedEmployeeAmount = req.FixedEmployeeAmount,
                FixedEmployerAmount = req.FixedEmployerAmount,
                SalaryFloor = req.SalaryFloor,
                SalaryCeiling = req.SalaryCeiling,
                EmployeeFormula = req.EmployeeFormula,
                EmployerFormula = req.EmployerFormula
            };

            try
            {
                var vars = BuildFormulaVariables(tempSchedule, req.MonthlySalary);
                var eeShare = ContributionFormulaEvaluator.Evaluate(req.EmployeeFormula, vars);
                var erShare = ContributionFormulaEvaluator.Evaluate(req.EmployerFormula, vars);
                return Results.Ok(new
                {
                    Valid = true,
                    EmployeeShare = eeShare,
                    EmployerShare = erShare,
                    Variables = vars
                });
            }
            catch (FormatException ex)
            {
                return Results.BadRequest(new { message = ex.Message });
            }
        });

        // Simulate/preview dynamic contributions + dynamic withholding tax for any given Monthly Salary and Date
        group.MapGet("/preview", async (decimal monthlySalary, DateOnly? asOfDate, AppDbContext db) =>
        {
            var targetDate = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var types = await db.ContributionTypes
                .AsNoTracking()
                .Where(c => c.IsActive)
                .Include(c => c.Schedules)
                .ThenInclude(s => s.Brackets)
                .OrderByDescending(c => c.IsSystemDefault)
                .ThenBy(c => c.Code)
                .ToListAsync();

            var breakdown = new List<ContributionLineResult>();
            decimal deductibleEeTotal = 0m;

            foreach (var type in types)
            {
                var activeSchedule = type.Schedules
                    .Where(s => s.EffectiveFrom <= targetDate && (!s.EffectiveTo.HasValue || s.EffectiveTo >= targetDate))
                    .OrderByDescending(s => s.EffectiveFrom)
                    .FirstOrDefault();

                if (activeSchedule is not null)
                {
                    var eval = EvaluateSchedule(type, activeSchedule, monthlySalary);
                    breakdown.Add(eval);
                    if (type.IsTaxDeductible)
                        deductibleEeTotal += eval.EmployeeShare;
                }
            }

            var taxBrackets = await db.TaxBrackets
                .AsNoTracking()
                .Where(tb => tb.EffectiveFrom <= targetDate && (!tb.EffectiveTo.HasValue || tb.EffectiveTo >= targetDate))
                .OrderBy(tb => tb.MinMonthlyIncome)
                .ToListAsync();

            var monthlyTaxableIncome = Math.Max(0m, monthlySalary - deductibleEeTotal);
            var (monthlyTax, matchedBracket, appliedTaxFormula) = EvaluateTaxBrackets(taxBrackets, monthlyTaxableIncome);
            var totalEe = breakdown.Sum(b => b.EmployeeShare);

            return Results.Ok(new
            {
                MonthlySalary = monthlySalary,
                AsOfDate = targetDate,
                TotalEmployeeShare = totalEe,
                TotalEmployerShare = breakdown.Sum(b => b.EmployerShare + b.EmployerEcShare),
                MonthlyTaxableIncome = monthlyTaxableIncome,
                EstimatedMonthlyTax = monthlyTax,
                MatchedTaxBracket = matchedBracket,
                AppliedTaxFormula = appliedTaxFormula,
                EstimatedMonthlyNetPay = Math.Max(0m, monthlySalary - totalEe - monthlyTax),
                Contributions = breakdown
            });
        });

        // ====================================================================
        // DYNAMIC WITHHOLDING TAX BRACKET & FORMULA ENDPOINTS
        // ====================================================================
        group.MapGet("/tax-brackets", async (AppDbContext db) =>
        {
            var list = await db.TaxBrackets
                .AsNoTracking()
                .OrderBy(b => b.MinMonthlyIncome)
                .ToListAsync();
            return Results.Ok(list);
        });

        group.MapPost("/tax-brackets", async (SaveTaxBracketRequest req, AppDbContext db) =>
        {
            if (!string.IsNullOrWhiteSpace(req.TaxFormula))
            {
                try
                {
                    var testVars = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["taxable"] = 35000m,
                        ["salary"] = 35000m,
                        ["min_income"] = req.MinMonthlyIncome,
                        ["base_tax"] = req.BaseTax,
                        ["excess_over"] = req.ExcessOverAmount,
                        ["rate"] = req.ExcessRatePercent
                    };
                    ContributionFormulaEvaluator.Evaluate(req.TaxFormula, testVars);
                }
                catch (FormatException ex)
                {
                    return Results.BadRequest(new { message = $"Tax formula error: {ex.Message}" });
                }
            }

            var entity = new TaxBracket
            {
                BracketName = req.BracketName.Trim(),
                EffectiveFrom = req.EffectiveFrom,
                MinMonthlyIncome = req.MinMonthlyIncome,
                MaxMonthlyIncome = req.MaxMonthlyIncome,
                BaseTax = req.BaseTax,
                ExcessOverAmount = req.ExcessOverAmount,
                ExcessRatePercent = req.ExcessRatePercent,
                TaxFormula = string.IsNullOrWhiteSpace(req.TaxFormula)
                    ? "base_tax + max(0, taxable - excess_over) * (rate / 100)"
                    : req.TaxFormula.Trim()
            };

            db.TaxBrackets.Add(entity);
            await db.SaveChangesAsync();
            return Results.Created($"/api/contributions/tax-brackets/{entity.Id}", entity);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapPut("/tax-brackets/{id:guid}", async (Guid id, SaveTaxBracketRequest req, AppDbContext db) =>
        {
            var entity = await db.TaxBrackets.FirstOrDefaultAsync(b => b.Id == id);
            if (entity is null)
                return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(req.TaxFormula))
            {
                try
                {
                    var testVars = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["taxable"] = 35000m,
                        ["salary"] = 35000m,
                        ["min_income"] = req.MinMonthlyIncome,
                        ["base_tax"] = req.BaseTax,
                        ["excess_over"] = req.ExcessOverAmount,
                        ["rate"] = req.ExcessRatePercent
                    };
                    ContributionFormulaEvaluator.Evaluate(req.TaxFormula, testVars);
                }
                catch (FormatException ex)
                {
                    return Results.BadRequest(new { message = $"Tax formula error: {ex.Message}" });
                }
            }

            entity.BracketName = req.BracketName.Trim();
            entity.EffectiveFrom = req.EffectiveFrom;
            entity.MinMonthlyIncome = req.MinMonthlyIncome;
            entity.MaxMonthlyIncome = req.MaxMonthlyIncome;
            entity.BaseTax = req.BaseTax;
            entity.ExcessOverAmount = req.ExcessOverAmount;
            entity.ExcessRatePercent = req.ExcessRatePercent;
            entity.TaxFormula = string.IsNullOrWhiteSpace(req.TaxFormula)
                ? "base_tax + max(0, taxable - excess_over) * (rate / 100)"
                : req.TaxFormula.Trim();

            await db.SaveChangesAsync();
            return Results.Ok(entity);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapDelete("/tax-brackets/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var entity = await db.TaxBrackets.FirstOrDefaultAsync(b => b.Id == id);
            if (entity is null)
                return Results.NotFound();

            db.TaxBrackets.Remove(entity);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);
    }
}
