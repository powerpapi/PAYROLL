using System.Globalization;
using System.Text;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.LoansAndBenefits;

public static class LoansAndBenefitsSlice
{
    // Request Records
    public record CreateLoanRequest(
        Guid EmployeeId,
        string LoanType,
        string ReferenceNumber,
        decimal PrincipalAmount,
        decimal TotalAmountDue,
        decimal MonthlyAmortization,
        int TermMonths,
        DateOnly StartDate,
        DateOnly EndDate,
        string? Remarks);

    public record RecordLoanPaymentRequest(
        decimal Amount,
        DateOnly PaymentDate,
        string PaymentMethod,
        string? Remarks);

    public record CreateBenefitRequest(
        string Code,
        string Name,
        string Category,
        string? Description,
        decimal CoverageAmount,
        bool IsTaxable);

    public record EnrollBenefitRequest(
        Guid EmployeeId,
        Guid CompanyBenefitId,
        DateOnly EnrollmentDate,
        decimal? CoverageAmount,
        string? Remarks);

    public class CreateLoanValidator : AbstractValidator<CreateLoanRequest>
    {
        public CreateLoanValidator()
        {
            RuleFor(x => x.EmployeeId).NotEmpty();
            RuleFor(x => x.LoanType).NotEmpty().MaximumLength(64);
            RuleFor(x => x.ReferenceNumber).NotEmpty().MaximumLength(64);
            RuleFor(x => x.PrincipalAmount).GreaterThan(0);
            RuleFor(x => x.TotalAmountDue).GreaterThanOrEqualTo(x => x.PrincipalAmount);
            RuleFor(x => x.MonthlyAmortization).GreaterThan(0);
            RuleFor(x => x.TermMonths).GreaterThan(0);
        }
    }

    public static void MapLoansAndBenefitsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/loans-and-benefits")
            .WithTags("Phase 7: Loans, Benefits & 13th-Month Pay")
            .RequireAuthorization();

        // ====================================================================
        // 1. LOANS MANAGEMENT (Government Loans & Company Loans)
        // ====================================================================
        group.MapGet("/loans", async (Guid? employeeId, string? status, AppDbContext db) =>
        {
            var query = db.EmployeeLoans
                .AsNoTracking()
                .Include(l => l.Employee)
                    .ThenInclude(e => e!.Department)
                .Include(l => l.Payments)
                .AsQueryable();

            if (employeeId.HasValue)
                query = query.Where(l => l.EmployeeId == employeeId.Value);

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                query = query.Where(l => l.Status == status);

            var loans = await query
                .OrderBy(l => l.Employee!.LastName)
                .ThenBy(l => l.LoanType)
                .Select(l => new
                {
                    l.Id,
                    l.EmployeeId,
                    EmployeeCode = l.Employee != null ? l.Employee.EmployeeCode : "",
                    EmployeeName = l.Employee != null ? $"{l.Employee.LastName}, {l.Employee.FirstName}" : "",
                    DepartmentName = l.Employee != null && l.Employee.Department != null ? l.Employee.Department.Name : "",
                    l.LoanType,
                    l.ReferenceNumber,
                    l.PrincipalAmount,
                    l.TotalAmountDue,
                    l.MonthlyAmortization,
                    l.AmortizationPerCutoff,
                    l.RemainingBalance,
                    TotalPaid = l.TotalAmountDue - l.RemainingBalance,
                    l.TermMonths,
                    StartDate = l.StartDate.ToString("yyyy-MM-dd"),
                    EndDate = l.EndDate.ToString("yyyy-MM-dd"),
                    l.Status,
                    l.Remarks,
                    PaymentsCount = l.Payments.Count,
                    Payments = l.Payments
                        .OrderByDescending(p => p.PaymentDate)
                        .Select(p => new
                        {
                            p.Id,
                            p.PaymentDate,
                            p.Amount,
                            p.PaymentMethod,
                            p.Remarks
                        }).ToList()
                })
                .ToListAsync();

            return Results.Ok(loans);
        });

        group.MapPost("/loans", async (
            CreateLoanRequest request,
            IValidator<CreateLoanRequest> validator,
            AppDbContext db) =>
        {
            var validation = await validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());

            var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == request.EmployeeId);
            if (emp is null)
                return Results.BadRequest(new { message = "Employee not found." });

            var cutoffAmort = Math.Round(request.MonthlyAmortization / 2m, 2);

            var loan = new EmployeeLoan
            {
                EmployeeId = request.EmployeeId,
                LoanType = request.LoanType.Trim(),
                ReferenceNumber = request.ReferenceNumber.Trim(),
                PrincipalAmount = request.PrincipalAmount,
                TotalAmountDue = request.TotalAmountDue,
                MonthlyAmortization = request.MonthlyAmortization,
                AmortizationPerCutoff = cutoffAmort,
                RemainingBalance = request.TotalAmountDue,
                TermMonths = request.TermMonths,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                Status = "Active",
                Remarks = request.Remarks?.Trim()
            };

            db.EmployeeLoans.Add(loan);
            await db.SaveChangesAsync();

            return Results.Created($"/api/loans-and-benefits/loans/{loan.Id}", loan);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapPost("/loans/{id:guid}/payment", async (
            Guid id,
            RecordLoanPaymentRequest request,
            AppDbContext db) =>
        {
            var loan = await db.EmployeeLoans.FirstOrDefaultAsync(l => l.Id == id);
            if (loan is null)
                return Results.NotFound();

            if (request.Amount <= 0)
                return Results.BadRequest(new { message = "Payment amount must be greater than zero." });

            var payment = new LoanPayment
            {
                EmployeeLoanId = loan.Id,
                PaymentDate = request.PaymentDate,
                Amount = request.Amount,
                PaymentMethod = request.PaymentMethod,
                Remarks = request.Remarks?.Trim()
            };

            db.LoanPayments.Add(payment);

            loan.RemainingBalance = Math.Max(0m, loan.RemainingBalance - request.Amount);
            if (loan.RemainingBalance <= 0)
            {
                loan.Status = "PaidOff";
            }

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                loan.Id,
                loan.RemainingBalance,
                loan.Status,
                PaymentId = payment.Id,
                AmountPaid = payment.Amount
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapDelete("/loans/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var loan = await db.EmployeeLoans.FirstOrDefaultAsync(l => l.Id == id);
            if (loan is null)
                return Results.NotFound();

            db.EmployeeLoans.Remove(loan);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // ====================================================================
        // 2. COMPANY BENEFITS CATALOG & ENROLLMENTS
        // ====================================================================
        group.MapGet("/benefits", async (AppDbContext db) =>
        {
            var benefits = await db.CompanyBenefits
                .AsNoTracking()
                .Include(b => b.Enrollments)
                .OrderBy(b => b.Category)
                .ThenBy(b => b.Name)
                .Select(b => new
                {
                    b.Id,
                    b.Code,
                    b.Name,
                    b.Category,
                    b.Description,
                    b.CoverageAmount,
                    b.IsTaxable,
                    b.IsActive,
                    EnrolledCount = b.Enrollments.Count(e => e.Status == "Active")
                })
                .ToListAsync();

            return Results.Ok(benefits);
        });

        group.MapPost("/benefits", async (CreateBenefitRequest request, AppDbContext db) =>
        {
            var code = request.Code.Trim().ToUpperInvariant();
            if (await db.CompanyBenefits.AnyAsync(b => b.Code == code))
                return Results.Conflict(new { message = $"Benefit code '{code}' already exists." });

            var benefit = new CompanyBenefit
            {
                Code = code,
                Name = request.Name.Trim(),
                Category = request.Category.Trim(),
                Description = request.Description?.Trim(),
                CoverageAmount = request.CoverageAmount,
                IsTaxable = request.IsTaxable,
                IsActive = true
            };

            db.CompanyBenefits.Add(benefit);
            await db.SaveChangesAsync();

            return Results.Created($"/api/loans-and-benefits/benefits/{benefit.Id}", benefit);
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapGet("/benefits/enrollments", async (Guid? benefitId, Guid? employeeId, AppDbContext db) =>
        {
            var query = db.EmployeeBenefitEnrollments
                .AsNoTracking()
                .Include(e => e.Employee)
                    .ThenInclude(emp => emp!.Department)
                .Include(e => e.CompanyBenefit)
                .AsQueryable();

            if (benefitId.HasValue)
                query = query.Where(e => e.CompanyBenefitId == benefitId.Value);

            if (employeeId.HasValue)
                query = query.Where(e => e.EmployeeId == employeeId.Value);

            var enrollments = await query
                .OrderBy(e => e.Employee!.LastName)
                .Select(e => new
                {
                    e.Id,
                    e.EmployeeId,
                    EmployeeCode = e.Employee != null ? e.Employee.EmployeeCode : "",
                    EmployeeName = e.Employee != null ? $"{e.Employee.LastName}, {e.Employee.FirstName}" : "",
                    DepartmentName = e.Employee != null && e.Employee.Department != null ? e.Employee.Department.Name : "",
                    e.CompanyBenefitId,
                    BenefitCode = e.CompanyBenefit != null ? e.CompanyBenefit.Code : "",
                    BenefitName = e.CompanyBenefit != null ? e.CompanyBenefit.Name : "",
                    BenefitCategory = e.CompanyBenefit != null ? e.CompanyBenefit.Category : "",
                    e.CoverageAmount,
                    EnrollmentDate = e.EnrollmentDate.ToString("yyyy-MM-dd"),
                    e.Status,
                    e.Remarks
                })
                .ToListAsync();

            return Results.Ok(enrollments);
        });

        group.MapPost("/benefits/enroll", async (EnrollBenefitRequest request, AppDbContext db) =>
        {
            var benefit = await db.CompanyBenefits.FirstOrDefaultAsync(b => b.Id == request.CompanyBenefitId);
            if (benefit is null)
                return Results.BadRequest(new { message = "Benefit not found." });

            var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == request.EmployeeId);
            if (emp is null)
                return Results.BadRequest(new { message = "Employee not found." });

            var existing = await db.EmployeeBenefitEnrollments.FirstOrDefaultAsync(e =>
                e.EmployeeId == request.EmployeeId && e.CompanyBenefitId == request.CompanyBenefitId && e.Status == "Active");

            if (existing is not null)
                return Results.Conflict(new { message = "Employee is already actively enrolled in this company benefit." });

            var coverage = request.CoverageAmount ?? benefit.CoverageAmount;

            var enrollment = new EmployeeBenefitEnrollment
            {
                EmployeeId = request.EmployeeId,
                CompanyBenefitId = request.CompanyBenefitId,
                EnrollmentDate = request.EnrollmentDate,
                CoverageAmount = coverage,
                Status = "Active",
                Remarks = request.Remarks?.Trim()
            };

            db.EmployeeBenefitEnrollments.Add(enrollment);
            await db.SaveChangesAsync();

            return Results.Created($"/api/loans-and-benefits/benefits/enrollments/{enrollment.Id}", enrollment);
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        group.MapDelete("/benefits/enrollments/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var enrollment = await db.EmployeeBenefitEnrollments.FirstOrDefaultAsync(e => e.Id == id);
            if (enrollment is null)
                return Results.NotFound();

            db.EmployeeBenefitEnrollments.Remove(enrollment);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(RbacPolicies.HrOrAdmin);

        // ====================================================================
        // 3. 13TH-MONTH PAY ACCRUAL & YEAR-END PAYOUT ENGINE
        // ====================================================================
        group.MapGet("/thirteenth-month/accrual", async (int? year, AppDbContext db) =>
        {
            var targetYear = year ?? DateTime.UtcNow.Year;

            // Load all employees with department
            var employees = await db.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .Where(e => e.IsActive)
                .OrderBy(e => e.LastName)
                .ToListAsync();

            // Load all computed or finalized payroll items for the target year
            var startOfYear = new DateOnly(targetYear, 1, 1);
            var endOfYear = new DateOnly(targetYear, 12, 31);

            var periods = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                .Where(p => p.StartDate >= startOfYear && p.EndDate <= endOfYear && p.Status != "Draft")
                .ToListAsync();

            var allPayrollItems = periods.SelectMany(p => p.Items).ToList();

            var records = new List<object>();
            const decimal TaxExemptLimit = 90_000m; // Philippine TRAIN Law statutory exemption limit

            foreach (var emp in employees)
            {
                var empItems = allPayrollItems.Where(i => i.EmployeeId == emp.Id).ToList();

                decimal totalBasicSalaryEarned;
                decimal totalAbsenceDed;

                if (empItems.Count > 0)
                {
                    totalBasicSalaryEarned = empItems.Sum(i => i.BasicPay);
                    totalAbsenceDed = empItems.Sum(i => i.AbsenceDeduction);
                }
                else
                {
                    // Fallback projection: compute pro-rated months active in year
                    var hireDate = emp.HireDate;
                    var monthsActive = hireDate.Year == targetYear
                        ? Math.Max(1, 12 - hireDate.Month + 1)
                        : 12;

                    totalBasicSalaryEarned = emp.BasicMonthlySalary * monthsActive;
                    totalAbsenceDed = 0m;
                }

                var netBasic = Math.Max(0m, totalBasicSalaryEarned - totalAbsenceDed);
                var thirteenthMonthPay = Math.Round(netBasic / 12m, 2);

                // TRAIN Law Tax-Exempt / Taxable breakdown
                var taxExempt = Math.Min(thirteenthMonthPay, TaxExemptLimit);
                var taxable = Math.Max(0m, thirteenthMonthPay - TaxExemptLimit);
                var estTax = taxable > 0 ? Math.Round(taxable * 0.20m, 2) : 0m;
                var netPayout = thirteenthMonthPay - estTax;

                records.Add(new
                {
                    emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    EmployeeName = $"{emp.LastName}, {emp.FirstName}",
                    Department = emp.Department?.Name ?? "General",
                    JobTitle = emp.JobTitle,
                    HireDate = emp.HireDate.ToString("yyyy-MM-dd"),
                    BasicMonthlySalary = emp.BasicMonthlySalary,
                    TotalBasicEarnedYtd = totalBasicSalaryEarned,
                    TotalAbsenceDeductions = totalAbsenceDed,
                    NetBasicSalary = netBasic,
                    ThirteenthMonthPay = thirteenthMonthPay,
                    TaxExemptAmount = taxExempt,
                    TaxableAmount = taxable,
                    EstimatedTax = estTax,
                    NetPayout = netPayout
                });
            }

            var totalGrossThirteenth = records.Sum(r => (decimal)((dynamic)r).ThirteenthMonthPay);
            var totalTaxExempt = records.Sum(r => (decimal)((dynamic)r).TaxExemptAmount);
            var totalTaxable = records.Sum(r => (decimal)((dynamic)r).TaxableAmount);
            var totalNetPayout = records.Sum(r => (decimal)((dynamic)r).NetPayout);

            return Results.Ok(new
            {
                Year = targetYear,
                TotalEmployees = records.Count,
                TotalGrossThirteenthMonth = totalGrossThirteenth,
                TotalTaxExempt = totalTaxExempt,
                TotalTaxable = totalTaxable,
                TotalNetPayout = totalNetPayout,
                TaxExemptThreshold = TaxExemptLimit,
                Records = records
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapGet("/thirteenth-month/export-csv", async (int? year, AppDbContext db) =>
        {
            var targetYear = year ?? DateTime.UtcNow.Year;

            var employees = await db.Employees
                .AsNoTracking()
                .Include(e => e.Department)
                .Where(e => e.IsActive)
                .OrderBy(e => e.LastName)
                .ToListAsync();

            var startOfYear = new DateOnly(targetYear, 1, 1);
            var endOfYear = new DateOnly(targetYear, 12, 31);

            var periods = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                .Where(p => p.StartDate >= startOfYear && p.EndDate <= endOfYear && p.Status != "Draft")
                .ToListAsync();

            var allPayrollItems = periods.SelectMany(p => p.Items).ToList();
            const decimal TaxExemptLimit = 90_000m;

            var sb = new StringBuilder();
            sb.AppendLine($"\"13TH-MONTH PAY DISBURSEMENT REGISTER - {targetYear}\"");
            sb.AppendLine($"\"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss UTC} | Statutory Exemption Ceiling: ₱{TaxExemptLimit:N2}\"");
            sb.AppendLine();
            sb.AppendLine("Employee Code,Employee Name,Department,Job Title,Hire Date,Monthly Salary,Total Earned Basic,Absence Ded,Net Basic,13th-Month Pay,Tax-Exempt (₱90k),Taxable Excess,Est Tax,Net Payout");

            foreach (var emp in employees)
            {
                var empItems = allPayrollItems.Where(i => i.EmployeeId == emp.Id).ToList();
                decimal totalBasic = empItems.Count > 0 ? empItems.Sum(i => i.BasicPay) : (emp.BasicMonthlySalary * 12m);
                decimal absDed = empItems.Count > 0 ? empItems.Sum(i => i.AbsenceDeduction) : 0m;

                var netBasic = Math.Max(0m, totalBasic - absDed);
                var gross13th = Math.Round(netBasic / 12m, 2);
                var taxExempt = Math.Min(gross13th, TaxExemptLimit);
                var taxable = Math.Max(0m, gross13th - TaxExemptLimit);
                var estTax = taxable > 0 ? Math.Round(taxable * 0.20m, 2) : 0m;
                var netPayout = gross13th - estTax;

                sb.AppendLine(string.Join(",",
                    EscapeCsv(emp.EmployeeCode),
                    EscapeCsv($"{emp.LastName}, {emp.FirstName}"),
                    EscapeCsv(emp.Department?.Name ?? ""),
                    EscapeCsv(emp.JobTitle),
                    emp.HireDate.ToString("yyyy-MM-dd"),
                    emp.BasicMonthlySalary.ToString("F2", CultureInfo.InvariantCulture),
                    totalBasic.ToString("F2", CultureInfo.InvariantCulture),
                    absDed.ToString("F2", CultureInfo.InvariantCulture),
                    netBasic.ToString("F2", CultureInfo.InvariantCulture),
                    gross13th.ToString("F2", CultureInfo.InvariantCulture),
                    taxExempt.ToString("F2", CultureInfo.InvariantCulture),
                    taxable.ToString("F2", CultureInfo.InvariantCulture),
                    estTax.ToString("F2", CultureInfo.InvariantCulture),
                    netPayout.ToString("F2", CultureInfo.InvariantCulture)
                ));
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var filename = $"13thMonthPay_Register_{targetYear}.csv";
            return Results.File(bytes, "text/csv", filename);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }
}
