using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Features.Reports;

public static class ReportsAndPayslipsSlice
{
    public static void MapReportsAndPayslipsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reports")
            .WithTags("Phase 6: Payslips and Reports")
            .RequireAuthorization();

        // ====================================================================
        // 1. INDIVIDUAL EMPLOYEE PAYSLIP DETAIL
        // ====================================================================
        group.MapGet("/payslips/{payrollItemId:guid}", async (Guid payrollItemId, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var item = await db.PayrollItems
                .AsNoTracking()
                .Include(pi => pi.PayrollPeriod)
                .Include(pi => pi.Employee)
                    .ThenInclude(e => e!.Department)
                .Include(pi => pi.Lines)
                .FirstOrDefaultAsync(pi => pi.Id == payrollItemId);

            if (item is null)
                return Results.NotFound();

            // Self-service security check: if role is Employee, only allow viewing their own payslip
            var role = principal.FindFirstValue(ClaimTypes.Role);
            var empIdClaim = principal.FindFirstValue("employee_id");
            if (role == UserRoles.Employee && empIdClaim != null && Guid.TryParse(empIdClaim, out var requestingEmpId))
            {
                if (item.EmployeeId != requestingEmpId)
                    return Results.Forbid();
            }

            var earningLines = item.Lines
                .Where(l => l.LineType == "Earning" || l.Amount > 0)
                .OrderBy(l => l.GroupName)
                .ThenBy(l => l.Code)
                .Select(l => new { l.Code, l.GroupName, l.Description, Amount = l.Amount })
                .ToList();

            var deductionLines = item.Lines
                .Where(l => l.LineType != "Earning" && l.Amount <= 0)
                .OrderBy(l => l.GroupName)
                .ThenBy(l => l.Code)
                .Select(l => new { l.Code, l.GroupName, l.Description, Amount = Math.Abs(l.Amount), EmployerShare = l.EmployerAmount })
                .ToList();

            var payslip = new
            {
                PayrollItemId = item.Id,
                PayrollPeriodId = item.PayrollPeriodId,
                PeriodCode = item.PayrollPeriod?.Code ?? "",
                PeriodName = item.PayrollPeriod?.Name ?? "",
                item.PayrollPeriod?.PayFrequency,
                item.PayrollPeriod?.CutoffSlot,
                StartDate = item.PayrollPeriod?.StartDate.ToString("yyyy-MM-dd"),
                EndDate = item.PayrollPeriod?.EndDate.ToString("yyyy-MM-dd"),
                PayDate = item.PayrollPeriod?.PayDate.ToString("yyyy-MM-dd"),
                PeriodStatus = item.PayrollPeriod?.Status ?? "",

                Employee = new
                {
                    item.EmployeeId,
                    EmployeeCode = item.Employee?.EmployeeCode ?? "",
                    FullName = $"{item.Employee?.LastName}, {item.Employee?.FirstName} {item.Employee?.MiddleName}".Trim(),
                    Department = item.Employee?.Department?.Name ?? "General",
                    JobTitle = item.Employee?.JobTitle ?? "",
                    item.Employee?.EmploymentStatus,
                    item.Employee?.TinNumber,
                    item.Employee?.SssNumber,
                    item.Employee?.PhilHealthNumber,
                    item.Employee?.PagIbigNumber,
                    BankName = item.Employee?.BankName ?? "Unassigned",
                    BankAccountNumber = item.Employee?.BankAccountNumber ?? "N/A",
                    BasicMonthlySalary = item.Employee?.BasicMonthlySalary ?? 0m,
                    DailyRate = item.Employee?.DailyRate ?? 0m,
                    HourlyRate = item.Employee?.HourlyRate ?? 0m
                },

                Attendance = new
                {
                    item.DaysWorked,
                    item.AbsentDays,
                    item.LateUndertimeMinutes,
                    item.OvertimeHours,
                    AbsenceDeduction = item.AbsenceDeduction,
                    LateUndertimeDeduction = item.LateUndertimeDeduction,
                    OvertimePay = item.OvertimePay,
                    HolidayPay = item.HolidayPay
                },

                Financials = new
                {
                    item.BasicPay,
                    item.GrossPay,
                    TotalEarnings = earningLines.Sum(l => l.Amount),
                    TotalDeductions = deductionLines.Sum(l => l.Amount),
                    item.TotalEmployeeContributions,
                    item.TotalEmployerContributions,
                    item.TaxableIncome,
                    item.WithholdingTax,
                    item.OtherDeductions,
                    item.NetPay
                },

                EarningLines = earningLines,
                DeductionLines = deductionLines
            };

            return Results.Ok(payslip);
        });

        // ====================================================================
        // 2. PAYSLIPS LIST FOR A PAY PERIOD (with Search & Pagination)
        // ====================================================================
        group.MapGet("/payslips", async (
            Guid periodId,
            string? search,
            Guid? departmentId,
            AppDbContext db) =>
        {
            var query = db.PayrollItems
                .AsNoTracking()
                .Include(pi => pi.Employee)
                    .ThenInclude(e => e!.Department)
                .Where(pi => pi.PayrollPeriodId == periodId)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(pi =>
                    pi.Employee!.EmployeeCode.ToLower().Contains(term) ||
                    pi.Employee.LastName.ToLower().Contains(term) ||
                    pi.Employee.FirstName.ToLower().Contains(term) ||
                    pi.Employee.JobTitle.ToLower().Contains(term));
            }

            if (departmentId.HasValue)
            {
                query = query.Where(pi => pi.Employee!.DepartmentId == departmentId.Value);
            }

            var items = await query
                .OrderBy(pi => pi.Employee!.LastName)
                .ThenBy(pi => pi.Employee!.FirstName)
                .Select(pi => new
                {
                    PayrollItemId = pi.Id,
                    pi.EmployeeId,
                    EmployeeCode = pi.Employee != null ? pi.Employee.EmployeeCode : "",
                    EmployeeName = pi.Employee != null ? $"{pi.Employee.LastName}, {pi.Employee.FirstName}" : "",
                    DepartmentName = pi.Employee != null && pi.Employee.Department != null ? pi.Employee.Department.Name : "",
                    JobTitle = pi.Employee != null ? pi.Employee.JobTitle : "",
                    BankName = pi.Employee != null ? pi.Employee.BankName : "",
                    BankAccountNumber = pi.Employee != null ? pi.Employee.BankAccountNumber : "",
                    pi.BasicPay,
                    pi.OvertimePay,
                    Allowances = pi.TaxableAllowances + pi.NonTaxableAllowances,
                    AttendanceDeductions = pi.AbsenceDeduction + pi.LateUndertimeDeduction,
                    pi.GrossPay,
                    pi.TotalEmployeeContributions,
                    pi.WithholdingTax,
                    pi.OtherDeductions,
                    pi.NetPay
                })
                .ToListAsync();

            return Results.Ok(items);
        });

        // ====================================================================
        // 3. MASTER PAYROLL REGISTER CSV EXPORT
        // ====================================================================
        group.MapGet("/payroll-register/csv", async (Guid periodId, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                        .ThenInclude(e => e!.Department)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var sb = new StringBuilder();
            sb.AppendLine($"\"PAYROLL REGISTER - {EscapeCsv(period.Name)} ({period.Code})\"");
            sb.AppendLine($"\"Cutoff: {period.StartDate:yyyy-MM-dd} to {period.EndDate:yyyy-MM-dd} | Pay Date: {period.PayDate:yyyy-MM-dd} | Status: {period.Status}\"");
            sb.AppendLine();

            sb.AppendLine("Employee Code,Employee Name,Department,Job Title,Bank,Account No,Basic Pay,Overtime Pay,Holiday Pay,Allowances,Gross Pay,Absence / Late Ded,Gov't Contrib (EE),Gov't Contrib (ER),Withholding Tax,Other Deductions,Net Pay");

            foreach (var item in period.Items.OrderBy(i => i.Employee?.LastName))
            {
                var emp = item.Employee;
                var alwTotal = item.TaxableAllowances + item.NonTaxableAllowances;
                var attDed = item.AbsenceDeduction + item.LateUndertimeDeduction;

                sb.AppendLine(string.Join(",",
                    EscapeCsv(emp?.EmployeeCode ?? ""),
                    EscapeCsv($"{emp?.LastName}, {emp?.FirstName}"),
                    EscapeCsv(emp?.Department?.Name ?? ""),
                    EscapeCsv(emp?.JobTitle ?? ""),
                    EscapeCsv(emp?.BankName ?? ""),
                    EscapeCsv(emp?.BankAccountNumber ?? ""),
                    item.BasicPay.ToString("F2", CultureInfo.InvariantCulture),
                    item.OvertimePay.ToString("F2", CultureInfo.InvariantCulture),
                    item.HolidayPay.ToString("F2", CultureInfo.InvariantCulture),
                    alwTotal.ToString("F2", CultureInfo.InvariantCulture),
                    item.GrossPay.ToString("F2", CultureInfo.InvariantCulture),
                    attDed.ToString("F2", CultureInfo.InvariantCulture),
                    item.TotalEmployeeContributions.ToString("F2", CultureInfo.InvariantCulture),
                    item.TotalEmployerContributions.ToString("F2", CultureInfo.InvariantCulture),
                    item.WithholdingTax.ToString("F2", CultureInfo.InvariantCulture),
                    item.OtherDeductions.ToString("F2", CultureInfo.InvariantCulture),
                    item.NetPay.ToString("F2", CultureInfo.InvariantCulture)
                ));
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var filename = $"PayrollRegister_{period.Code}_{DateTime.UtcNow:yyyyMMdd}.csv";
            return Results.File(bytes, "text/csv", filename);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // ====================================================================
        // 4. BANK DISBURSEMENT BATCH FILE (JSON & CSV DOWNLOAD)
        // ====================================================================
        group.MapGet("/bank-disbursement", async (Guid periodId, string? bankName, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var query = period.Items.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(bankName) && bankName != "ALL")
            {
                query = query.Where(i => string.Equals(i.Employee?.BankName, bankName, StringComparison.OrdinalIgnoreCase));
            }

            var items = query
                .OrderBy(i => i.Employee?.BankName)
                .ThenBy(i => i.Employee?.LastName)
                .Select(i => new
                {
                    i.EmployeeId,
                    EmployeeCode = i.Employee?.EmployeeCode ?? "",
                    EmployeeName = $"{i.Employee?.LastName}, {i.Employee?.FirstName}",
                    BankName = string.IsNullOrWhiteSpace(i.Employee?.BankName) ? "Unassigned" : i.Employee.BankName,
                    BankAccountNumber = string.IsNullOrWhiteSpace(i.Employee?.BankAccountNumber) ? "N/A" : i.Employee.BankAccountNumber,
                    NetPay = i.NetPay,
                    PayDate = period.PayDate.ToString("yyyy-MM-dd"),
                    Remarks = $"Salary {period.Code}"
                })
                .ToList();

            var bankSummaries = period.Items
                .GroupBy(i => string.IsNullOrWhiteSpace(i.Employee?.BankName) ? "Unassigned" : i.Employee.BankName)
                .Select(g => new
                {
                    BankName = g.Key,
                    Headcount = g.Count(),
                    TotalDisbursement = g.Sum(x => x.NetPay)
                })
                .OrderByDescending(b => b.TotalDisbursement)
                .ToList();

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Name,
                PayDate = period.PayDate.ToString("yyyy-MM-dd"),
                TotalHeadcount = items.Count,
                TotalDisbursementAmount = items.Sum(i => i.NetPay),
                BankSummaries = bankSummaries,
                DisbursementLines = items
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapGet("/bank-disbursement/csv", async (Guid periodId, string? bankName, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var query = period.Items.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(bankName) && bankName != "ALL")
            {
                query = query.Where(i => string.Equals(i.Employee?.BankName, bankName, StringComparison.OrdinalIgnoreCase));
            }

            var items = query
                .OrderBy(i => i.Employee?.BankName)
                .ThenBy(i => i.Employee?.LastName)
                .ToList();

            var sb = new StringBuilder();
            sb.AppendLine("Bank,Account Number,Account Name,Amount,Currency,Payment Description,Reference");

            foreach (var item in items)
            {
                var emp = item.Employee;
                var bank = string.IsNullOrWhiteSpace(emp?.BankName) ? "GENERIC" : emp.BankName;
                var acct = string.IsNullOrWhiteSpace(emp?.BankAccountNumber) ? "0000000000" : emp.BankAccountNumber;
                var name = $"{emp?.LastName}, {emp?.FirstName}";

                sb.AppendLine(string.Join(",",
                    EscapeCsv(bank),
                    EscapeCsv(acct),
                    EscapeCsv(name),
                    item.NetPay.ToString("F2", CultureInfo.InvariantCulture),
                    "PHP",
                    EscapeCsv($"Payroll {period.Code}"),
                    EscapeCsv(emp?.EmployeeCode ?? "")
                ));
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var bankSlug = string.IsNullOrWhiteSpace(bankName) || bankName == "ALL" ? "AllBanks" : bankName;
            var filename = $"BankDisbursement_{bankSlug}_{period.Code}.csv";
            return Results.File(bytes, "text/csv", filename);
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // ====================================================================
        // 5. DOUBLE-ENTRY ACCOUNTING GENERAL LEDGER SUMMARY
        // ====================================================================
        group.MapGet("/accounting-journal", async (Guid periodId, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Lines)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var items = period.Items.ToList();

            // Total Gross, OT, Allowances
            var basicPayTotal = items.Sum(i => i.BasicPay);
            var overtimeTotal = items.Sum(i => i.OvertimePay);
            var holidayTotal = items.Sum(i => i.HolidayPay);
            var allowancesTotal = items.Sum(i => i.TaxableAllowances + i.NonTaxableAllowances);

            // Deductions & Payables
            var sssEe = items.SelectMany(i => i.Lines).Where(l => l.Code == "SSS").Sum(l => Math.Abs(l.Amount));
            var sssEr = items.SelectMany(i => i.Lines).Where(l => l.Code == "SSS").Sum(l => l.EmployerAmount);

            var philHealthEe = items.SelectMany(i => i.Lines).Where(l => l.Code == "PHILHEALTH").Sum(l => Math.Abs(l.Amount));
            var philHealthEr = items.SelectMany(i => i.Lines).Where(l => l.Code == "PHILHEALTH").Sum(l => l.EmployerAmount);

            var pagIbigEe = items.SelectMany(i => i.Lines).Where(l => l.Code == "PAGIBIG").Sum(l => Math.Abs(l.Amount));
            var pagIbigEr = items.SelectMany(i => i.Lines).Where(l => l.Code == "PAGIBIG").Sum(l => l.EmployerAmount);

            var withholdingTaxTotal = items.Sum(i => i.WithholdingTax);
            var otherDeductionsTotal = items.Sum(i => i.OtherDeductions);
            var netPayTotal = items.Sum(i => i.NetPay);
            var totalErStatutory = sssEr + philHealthEr + pagIbigEr;

            // Attendance deductions offset basic pay
            var attDedTotal = items.Sum(i => i.AbsenceDeduction + i.LateUndertimeDeduction);

            var entries = new List<object>
            {
                // DEBITS (EXPENSES)
                new { AccountCode = "5010-01", AccountTitle = "Salaries and Wages Expense", Debit = Math.Max(0m, basicPayTotal - attDedTotal), Credit = 0m, Description = "Regular gross salary less absences/tardiness" },
                new { AccountCode = "5010-02", AccountTitle = "Overtime Expense", Debit = overtimeTotal, Credit = 0m, Description = "Approved employee overtime pay" },
                new { AccountCode = "5010-03", AccountTitle = "Holiday Premium Expense", Debit = holidayTotal, Credit = 0m, Description = "Worked regular & special holiday premiums" },
                new { AccountCode = "5010-04", AccountTitle = "Employee Allowances & Subsidies", Debit = allowancesTotal, Credit = 0m, Description = "Taxable & De Minimis allowances" },
                new { AccountCode = "5020-01", AccountTitle = "Employer Statutory Contribution Expense", Debit = totalErStatutory, Credit = 0m, Description = "Company share for SSS, PhilHealth & Pag-IBIG" },

                // CREDITS (LIABILITIES & CASH)
                new { AccountCode = "2010-01", AccountTitle = "Withholding Tax Payable (BIR 1601-C)", Debit = 0m, Credit = withholdingTaxTotal, Description = "Compensation taxes withheld for BIR remittance" },
                new { AccountCode = "2020-01", AccountTitle = "SSS Premiums Payable", Debit = 0m, Credit = sssEe + sssEr, Description = "SSS EE share + ER share & EC payable" },
                new { AccountCode = "2020-02", AccountTitle = "PhilHealth Premiums Payable", Debit = 0m, Credit = philHealthEe + philHealthEr, Description = "PhilHealth EE share + ER share payable" },
                new { AccountCode = "2020-03", AccountTitle = "Pag-IBIG Premiums Payable", Debit = 0m, Credit = pagIbigEe + pagIbigEr, Description = "HDMF employee & employer mandatory contributions" },
                new { AccountCode = "2030-01", AccountTitle = "Other Employee Deductions / Advances", Debit = 0m, Credit = otherDeductionsTotal, Description = "Cash advances, HMO dependent share, loans" },
                new { AccountCode = "1010-01", AccountTitle = "Cash in Bank / Payroll Disbursement Account", Debit = 0m, Credit = netPayTotal, Description = "Net take-home pay for automated payroll credit" }
            };

            var totalDebit = (Math.Max(0m, basicPayTotal - attDedTotal)) + overtimeTotal + holidayTotal + allowancesTotal + totalErStatutory;
            var totalCredit = withholdingTaxTotal + (sssEe + sssEr) + (philHealthEe + philHealthEr) + (pagIbigEe + pagIbigEr) + otherDeductionsTotal + netPayTotal;

            return Results.Ok(new
            {
                period.Id,
                period.Code,
                period.Name,
                CutoffDate = $"{period.StartDate:yyyy-MM-dd} → {period.EndDate:yyyy-MM-dd}",
                PostingDate = period.PayDate.ToString("yyyy-MM-dd"),
                JournalNumber = $"JV-{period.Code}",
                TotalDebit = Math.Round(totalDebit, 2),
                TotalCredit = Math.Round(totalCredit, 2),
                IsBalanced = Math.Abs(totalDebit - totalCredit) < 0.05m,
                Entries = entries
            });
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        // ====================================================================
        // 6. STATUTORY COMPLIANCE REMITTANCE SCHEDULES (SSS, PhilHealth, Pag-IBIG, BIR)
        // ====================================================================
        group.MapGet("/statutory", async (Guid periodId, string type, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                .Include(p => p.Items)
                    .ThenInclude(i => i.Lines)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var cleanType = type.Trim().ToUpperInvariant();

            if (cleanType == "SSS")
            {
                var sssLines = period.Items
                    .Select(i =>
                    {
                        var sLine = i.Lines.FirstOrDefault(l => l.Code == "SSS");
                        var eeShare = sLine != null ? Math.Abs(sLine.Amount) : 0m;
                        var erShare = sLine != null ? sLine.EmployerAmount : 0m;
                        return new
                        {
                            i.EmployeeId,
                            EmployeeCode = i.Employee?.EmployeeCode ?? "",
                            Name = $"{i.Employee?.LastName}, {i.Employee?.FirstName}",
                            IdNumber = string.IsNullOrWhiteSpace(i.Employee?.SssNumber) ? "UNREGISTERED" : i.Employee.SssNumber,
                            MonthlyCompensation = i.Employee?.BasicMonthlySalary ?? 0m,
                            EmployeeShare = eeShare,
                            EmployerShare = erShare,
                            Total = eeShare + erShare
                        };
                    })
                    .OrderBy(x => x.Name)
                    .ToList();

                return Results.Ok(new
                {
                    Type = "SSS",
                    Agency = "Social Security System",
                    Form = "R-3 Monthly Remittance Schedule",
                    PeriodCode = period.Code,
                    TotalEmployeeShare = sssLines.Sum(x => x.EmployeeShare),
                    TotalEmployerShare = sssLines.Sum(x => x.EmployerShare),
                    GrandTotal = sssLines.Sum(x => x.Total),
                    Records = sssLines
                });
            }
            else if (cleanType == "PHILHEALTH")
            {
                var phLines = period.Items
                    .Select(i =>
                    {
                        var pLine = i.Lines.FirstOrDefault(l => l.Code == "PHILHEALTH");
                        var eeShare = pLine != null ? Math.Abs(pLine.Amount) : 0m;
                        var erShare = pLine != null ? pLine.EmployerAmount : 0m;
                        return new
                        {
                            i.EmployeeId,
                            EmployeeCode = i.Employee?.EmployeeCode ?? "",
                            Name = $"{i.Employee?.LastName}, {i.Employee?.FirstName}",
                            IdNumber = string.IsNullOrWhiteSpace(i.Employee?.PhilHealthNumber) ? "UNREGISTERED" : i.Employee.PhilHealthNumber,
                            MonthlyCompensation = i.Employee?.BasicMonthlySalary ?? 0m,
                            EmployeeShare = eeShare,
                            EmployerShare = erShare,
                            Total = eeShare + erShare
                        };
                    })
                    .OrderBy(x => x.Name)
                    .ToList();

                return Results.Ok(new
                {
                    Type = "PHILHEALTH",
                    Agency = "Philippine Health Insurance Corporation",
                    Form = "RF-1 Monthly Remittance Report",
                    PeriodCode = period.Code,
                    TotalEmployeeShare = phLines.Sum(x => x.EmployeeShare),
                    TotalEmployerShare = phLines.Sum(x => x.EmployerShare),
                    GrandTotal = phLines.Sum(x => x.Total),
                    Records = phLines
                });
            }
            else if (cleanType == "PAGIBIG")
            {
                var pagLines = period.Items
                    .Select(i =>
                    {
                        var pLine = i.Lines.FirstOrDefault(l => l.Code == "PAGIBIG");
                        var eeShare = pLine != null ? Math.Abs(pLine.Amount) : 0m;
                        var erShare = pLine != null ? pLine.EmployerAmount : 0m;
                        return new
                        {
                            i.EmployeeId,
                            EmployeeCode = i.Employee?.EmployeeCode ?? "",
                            Name = $"{i.Employee?.LastName}, {i.Employee?.FirstName}",
                            IdNumber = string.IsNullOrWhiteSpace(i.Employee?.PagIbigNumber) ? "UNREGISTERED" : i.Employee.PagIbigNumber,
                            MonthlyCompensation = i.Employee?.BasicMonthlySalary ?? 0m,
                            EmployeeShare = eeShare,
                            EmployerShare = erShare,
                            Total = eeShare + erShare
                        };
                    })
                    .OrderBy(x => x.Name)
                    .ToList();

                return Results.Ok(new
                {
                    Type = "PAGIBIG",
                    Agency = "Home Development Mutual Fund",
                    Form = "MCRF Monthly Remittance Schedule",
                    PeriodCode = period.Code,
                    TotalEmployeeShare = pagLines.Sum(x => x.EmployeeShare),
                    TotalEmployerShare = pagLines.Sum(x => x.EmployerShare),
                    GrandTotal = pagLines.Sum(x => x.Total),
                    Records = pagLines
                });
            }
            else // BIR 1601-C
            {
                var birLines = period.Items
                    .Select(i => new
                    {
                        i.EmployeeId,
                        EmployeeCode = i.Employee?.EmployeeCode ?? "",
                        Name = $"{i.Employee?.LastName}, {i.Employee?.FirstName}",
                        IdNumber = string.IsNullOrWhiteSpace(i.Employee?.TinNumber) ? "UNREGISTERED" : i.Employee.TinNumber,
                        GrossCompensation = i.GrossPay,
                        NonTaxableExempt = i.NonTaxableAllowances + i.TotalEmployeeContributions,
                        TaxableCompensation = i.TaxableIncome,
                        TaxWithheld = i.WithholdingTax
                    })
                    .OrderBy(x => x.Name)
                    .ToList();

                return Results.Ok(new
                {
                    Type = "BIR",
                    Agency = "Bureau of Internal Revenue",
                    Form = "BIR Form 1601-C Withholding Tax Schedule",
                    PeriodCode = period.Code,
                    TotalGross = birLines.Sum(x => x.GrossCompensation),
                    TotalNonTaxable = birLines.Sum(x => x.NonTaxableExempt),
                    TotalTaxable = birLines.Sum(x => x.TaxableCompensation),
                    TotalTaxWithheld = birLines.Sum(x => x.TaxWithheld),
                    Records = birLines
                });
            }
        }).RequireAuthorization(RbacPolicies.PayrollOrAdmin);

        group.MapGet("/statutory/csv", async (Guid periodId, string type, AppDbContext db) =>
        {
            var period = await db.PayrollPeriods
                .AsNoTracking()
                .Include(p => p.Items)
                    .ThenInclude(i => i.Employee)
                .Include(p => p.Items)
                    .ThenInclude(i => i.Lines)
                .FirstOrDefaultAsync(p => p.Id == periodId);

            if (period is null)
                return Results.NotFound();

            var cleanType = type.Trim().ToUpperInvariant();
            var sb = new StringBuilder();

            if (cleanType is "SSS" or "PHILHEALTH" or "PAGIBIG")
            {
                sb.AppendLine($"\"{cleanType} Statutory Remittance Schedule - {period.Code}\"");
                sb.AppendLine("Employee Code,Employee Name,ID / Registration Number,Basic Salary,EE Share,ER Share,Total");

                foreach (var item in period.Items.OrderBy(i => i.Employee?.LastName))
                {
                    var emp = item.Employee;
                    var line = item.Lines.FirstOrDefault(l => l.Code == cleanType);
                    var ee = line != null ? Math.Abs(line.Amount) : 0m;
                    var er = line != null ? line.EmployerAmount : 0m;
                    var idNum = cleanType switch
                    {
                        "SSS" => emp?.SssNumber,
                        "PHILHEALTH" => emp?.PhilHealthNumber,
                        _ => emp?.PagIbigNumber
                    };

                    sb.AppendLine(string.Join(",",
                        EscapeCsv(emp?.EmployeeCode ?? ""),
                        EscapeCsv($"{emp?.LastName}, {emp?.FirstName}"),
                        EscapeCsv(idNum ?? "UNREGISTERED"),
                        (emp?.BasicMonthlySalary ?? 0m).ToString("F2", CultureInfo.InvariantCulture),
                        ee.ToString("F2", CultureInfo.InvariantCulture),
                        er.ToString("F2", CultureInfo.InvariantCulture),
                        (ee + er).ToString("F2", CultureInfo.InvariantCulture)
                    ));
                }
            }
            else
            {
                sb.AppendLine($"\"BIR Form 1601-C Tax Withholding Schedule - {period.Code}\"");
                sb.AppendLine("Employee Code,Employee Name,TIN,Gross Compensation,Non-Taxable & Statutory,Taxable Income,Withholding Tax");

                foreach (var item in period.Items.OrderBy(i => i.Employee?.LastName))
                {
                    var emp = item.Employee;
                    var nonTax = item.NonTaxableAllowances + item.TotalEmployeeContributions;

                    sb.AppendLine(string.Join(",",
                        EscapeCsv(emp?.EmployeeCode ?? ""),
                        EscapeCsv($"{emp?.LastName}, {emp?.FirstName}"),
                        EscapeCsv(emp?.TinNumber ?? "UNREGISTERED"),
                        item.GrossPay.ToString("F2", CultureInfo.InvariantCulture),
                        nonTax.ToString("F2", CultureInfo.InvariantCulture),
                        item.TaxableIncome.ToString("F2", CultureInfo.InvariantCulture),
                        item.WithholdingTax.ToString("F2", CultureInfo.InvariantCulture)
                    ));
                }
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var filename = $"Statutory_{cleanType}_{period.Code}.csv";
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
