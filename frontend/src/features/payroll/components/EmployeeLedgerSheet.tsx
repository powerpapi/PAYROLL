import React from "react"
import {
  BanknoteIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  FileTextIcon,
  LandmarkIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export interface PayrollItemLine {
  id: string
  lineType: string
  groupName: string
  code: string
  description: string
  amount: number
  employerAmount: number
}

export interface PayrollItemDetail {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  jobTitle: string
  departmentName: string
  daysWorked: number
  absentDays: number
  lateUndertimeMinutes: number
  overtimeHours: number
  basicPay: number
  absenceDeduction: number
  lateUndertimeDeduction: number
  overtimePay: number
  taxableAllowances: number
  nonTaxableAllowances: number
  grossPay: number
  totalEmployeeContributions: number
  totalEmployerContributions: number
  taxableIncome: number
  withholdingTax: number
  otherDeductions: number
  netPay: number
  lines: PayrollItemLine[]
}

interface EmployeeLedgerSheetProps {
  item: PayrollItemDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  periodName: string
}

export function EmployeeLedgerSheet({
  item,
  open,
  onOpenChange,
  periodName,
}: EmployeeLedgerSheetProps) {
  if (!item) return null

  const earningLines = (item.lines || []).filter((l) => l.lineType === "Earning")
  const deductionLines = (item.lines || []).filter(
    (l) => l.lineType === "Deduction" || l.lineType === "Tax"
  )

  const totalDeductions =
    item.absenceDeduction +
    item.lateUndertimeDeduction +
    item.totalEmployeeContributions +
    item.withholdingTax +
    item.otherDeductions

  const takeHomeRatio = item.grossPay > 0 ? Math.round((item.netPay / item.grossPay) * 100) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-6"
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-mono text-xs">
              {item.employeeCode}
            </Badge>
            <span className="text-xs text-muted-foreground">{periodName}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-foreground">
            {item.employeeName}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {item.jobTitle || "Employee"} &bull; {item.departmentName || "General Department"}
          </SheetDescription>
        </SheetHeader>

        {/* Hero Card: Net Take-Home Pay */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Net Take-Home Pay
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₱{item.netPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Net/Gross Ratio</span>
            <Badge
              variant="secondary"
              className="mt-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            >
              {takeHomeRatio}% Take-Home
            </Badge>
          </div>
        </div>

        {/* Timekeeping & Attendance Summary */}
        <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5 text-primary" />
            Cutoff Timekeeping Summary
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="rounded bg-muted/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Days Worked</span>
              <span className="font-bold text-foreground text-sm">{item.daysWorked}</span>
            </div>
            <div className="rounded bg-muted/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Overtime</span>
              <span className="font-bold text-foreground text-sm">{item.overtimeHours}h</span>
            </div>
            <div className="rounded bg-muted/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Absences</span>
              <span className={`font-bold text-sm ${item.absentDays > 0 ? "text-red-500" : "text-foreground"}`}>
                {item.absentDays}d
              </span>
            </div>
            <div className="rounded bg-muted/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Late/UT</span>
              <span className={`font-bold text-sm ${item.lateUndertimeMinutes > 0 ? "text-amber-500" : "text-foreground"}`}>
                {item.lateUndertimeMinutes}m
              </span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Earnings vs Deductions Breakdown */}
        <div className="space-y-4">
          {/* Earnings Section */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <CoinsIcon className="size-4 text-emerald-500" />
                Gross Earnings
              </span>
              <span className="text-sm font-bold text-foreground">
                ₱{item.grossPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basic Pay:</span>
                <span className="font-medium font-mono">
                  ₱{item.basicPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {item.overtimePay > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime Pay:</span>
                  <span className="font-medium font-mono text-emerald-600 dark:text-emerald-400">
                    +₱{item.overtimePay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {item.taxableAllowances > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Allowances:</span>
                  <span className="font-medium font-mono">
                    +₱{item.taxableAllowances.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {item.nonTaxableAllowances > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">De Minimis / Non-Taxable:</span>
                  <span className="font-medium font-mono text-emerald-600 dark:text-emerald-400">
                    +₱{item.nonTaxableAllowances.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Itemized Dynamic Earnings lines */}
              {earningLines.length > 0 && (
                <div className="pt-2 border-t space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Itemized Allowances & Perks
                  </span>
                  {earningLines.map((line) => (
                    <div key={line.id} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{line.description}</span>
                      <span className="font-mono">+₱{line.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deductions Section */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ReceiptIcon className="size-4 text-red-500" />
                Itemized Deductions
              </span>
              <span className="text-sm font-bold text-red-500">
                -₱{totalDeductions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {item.absenceDeduction > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Absence Deduction:</span>
                  <span className="font-medium font-mono text-red-500">
                    -₱{item.absenceDeduction.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {item.lateUndertimeDeduction > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late / Undertime:</span>
                  <span className="font-medium font-mono text-red-500">
                    -₱{item.lateUndertimeDeduction.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Gov't Contributions (EE Share):</span>
                <span className="font-medium font-mono text-red-500">
                  -₱{item.totalEmployeeContributions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Withholding Tax (BIR):</span>
                <span className="font-medium font-mono text-red-500">
                  -₱{item.withholdingTax.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {item.otherDeductions > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loans & Cash Advances:</span>
                  <span className="font-medium font-mono text-red-500">
                    -₱{item.otherDeductions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Itemized Lines */}
              {deductionLines.length > 0 && (
                <div className="pt-2 border-t space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Statutory & Policy Deductions
                  </span>
                  {deductionLines.map((line) => (
                    <div key={line.id} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{line.description}</span>
                      <span className="font-mono text-red-500">-₱{line.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
