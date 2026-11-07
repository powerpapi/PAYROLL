import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  BanknoteIcon,
  Building2Icon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LandmarkIcon,
  PrinterIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { AuthUser, apiFetch } from "@/lib/api"

const formatCurrency = (val: number | undefined | null) =>
  (val ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

interface PeriodOption {
  id: string
  code: string
  name: string
  payFrequency: string
  startDate: string
  endDate: string
  payDate: string
  status: string
  employeeCount: number
  totalGrossPay: number
  totalNetPay: number
}

interface PayslipListItem {
  payrollItemId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string
  jobTitle: string
  bankName: string
  bankAccountNumber: string
  basicPay: number
  overtimePay: number
  allowances: number
  attendanceDeductions: number
  grossPay: number
  totalEmployeeContributions: number
  withholdingTax: number
  otherDeductions: number
  netPay: number
}

interface PayslipDetail {
  payrollItemId: string
  payrollPeriodId: string
  periodCode: string
  periodName: string
  payFrequency: string
  cutoffSlot: number
  startDate: string
  endDate: string
  payDate: string
  periodStatus: string
  employee: {
    employeeId: string
    employeeCode: string
    fullName: string
    department: string
    jobTitle: string
    employmentStatus: string
    tinNumber?: string | null
    sssNumber?: string | null
    philHealthNumber?: string | null
    pagIbigNumber?: string | null
    bankName: string
    bankAccountNumber: string
    basicMonthlySalary: number
    dailyRate: number
    hourlyRate: number
  }
  attendance: {
    daysWorked: number
    absentDays: number
    lateUndertimeMinutes: number
    overtimeHours: number
    absenceDeduction: number
    lateUndertimeDeduction: number
    overtimePay: number
    holidayPay: number
  }
  financials: {
    basicPay: number
    grossPay: number
    totalEarnings: number
    totalDeductions: number
    totalEmployeeContributions: number
    totalEmployerContributions: number
    taxableIncome: number
    withholdingTax: number
    otherDeductions: number
    netPay: number
  }
  earningLines: { code: string; groupName: string; description: string; amount: number }[]
  deductionLines: { code: string; groupName: string; description: string; amount: number; employerShare: number }[]
}

interface BankSummary {
  bankName: string
  headcount: number
  totalDisbursement: number
}

interface DisbursementLine {
  employeeId: string
  employeeCode: string
  employeeName: string
  bankName: string
  bankAccountNumber: string
  netPay: number
  payDate: string
  remarks: string
}

interface BankDisbursementResponse {
  periodId: string
  code: string
  name: string
  payDate: string
  totalHeadcount: number
  totalDisbursementAmount: number
  bankSummaries: BankSummary[]
  disbursementLines: DisbursementLine[]
}

interface JournalEntry {
  accountCode: string
  accountTitle: string
  debit: number
  credit: number
  description: string
}

interface AccountingJournalResponse {
  periodId: string
  code: string
  name: string
  cutoffDate: string
  postingDate: string
  journalNumber: string
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  entries: JournalEntry[]
}

interface StatutoryRecord {
  employeeId: string
  employeeCode: string
  name: string
  idNumber: string
  monthlyCompensation?: number
  employeeShare?: number
  employerShare?: number
  total?: number
  grossCompensation?: number
  nonTaxableExempt?: number
  taxableCompensation?: number
  taxWithheld?: number
}

interface StatutoryReportResponse {
  type: string
  agency: string
  form: string
  periodCode: string
  totalEmployeeShare?: number
  totalEmployerShare?: number
  grandTotal?: number
  totalGross?: number
  totalNonTaxable?: number
  totalTaxable?: number
  totalTaxWithheld?: number
  records: StatutoryRecord[]
}

export function ReportsAndPayslipsPage({ user }: { user: AuthUser }) {
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [payslips, setPayslips] = useState<PayslipListItem[]>([])

  // Selected Payslip for Modal & Printing
  const [activePayslip, setActivePayslip] = useState<PayslipDetail | null>(null)
  const [loadingPayslip, setLoadingPayslip] = useState(false)

  // Bank Disbursement Data
  const [bankData, setBankData] = useState<BankDisbursementResponse | null>(null)
  const [selectedBankFilter, setSelectedBankFilter] = useState("ALL")

  // Accounting Journal Data
  const [journalData, setJournalData] = useState<AccountingJournalResponse | null>(null)

  // Statutory Data
  const [statutoryType, setStatutoryType] = useState<"SSS" | "PHILHEALTH" | "PAGIBIG" | "BIR">("SSS")
  const [statutoryData, setStatutoryData] = useState<StatutoryReportResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)

  const loadOverview = async (targetId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const pData = await apiFetch<PeriodOption[]>("/api/payroll/approvals")
      setPeriods(pData)

      const activeId = targetId || selectedPeriodId || pData[0]?.id || ""
      if (activeId) {
        setSelectedPeriodId(activeId)
        await loadPeriodReports(activeId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodReports = async (periodId: string) => {
    try {
      const [psData, bData, jData, sData] = await Promise.all([
        apiFetch<PayslipListItem[]>(`/api/reports/payslips?periodId=${periodId}`),
        apiFetch<BankDisbursementResponse>(`/api/reports/bank-disbursement?periodId=${periodId}`),
        apiFetch<AccountingJournalResponse>(`/api/reports/accounting-journal?periodId=${periodId}`),
        apiFetch<StatutoryReportResponse>(`/api/reports/statutory?periodId=${periodId}&type=${statutoryType}`),
      ])
      setPayslips(psData)
      setBankData(bData)
      setJournalData(jData)
      setStatutoryData(sData)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  const handlePeriodChange = async (id: string) => {
    setSelectedPeriodId(id)
    await loadPeriodReports(id)
  }

  const handleStatutoryTypeChange = async (type: "SSS" | "PHILHEALTH" | "PAGIBIG" | "BIR") => {
    setStatutoryType(type)
    if (!selectedPeriodId) return
    try {
      const data = await apiFetch<StatutoryReportResponse>(
        `/api/reports/statutory?periodId=${selectedPeriodId}&type=${type}`
      )
      setStatutoryData(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openPayslipDetail = async (payrollItemId: string) => {
    setLoadingPayslip(true)
    setError(null)
    try {
      const data = await apiFetch<PayslipDetail>(`/api/reports/payslips/${payrollItemId}`)
      setActivePayslip(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingPayslip(false)
    }
  }

  const activePayslipIndex = useMemo(() => {
    if (!activePayslip) return -1
    return payslips.findIndex((p) => p.payrollItemId === activePayslip.payrollItemId)
  }, [activePayslip, payslips])

  const handleNavigatePayslip = (direction: "prev" | "next") => {
    if (activePayslipIndex === -1 || payslips.length <= 1 || loadingPayslip) return
    const nextIdx =
      direction === "prev"
        ? (activePayslipIndex - 1 + payslips.length) % payslips.length
        : (activePayslipIndex + 1) % payslips.length
    openPayslipDetail(payslips[nextIdx].payrollItemId)
  }

  useEffect(() => {
    if (!activePayslip) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handleNavigatePayslip("prev")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNavigatePayslip("next")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activePayslip, activePayslipIndex, payslips, loadingPayslip])

  const periodKpis = useMemo(() => {
    const totalGross = payslips.reduce((acc, p) => acc + p.grossPay, 0)
    const totalGovAndTax = payslips.reduce(
      (acc, p) => acc + p.totalEmployeeContributions + p.withholdingTax,
      0
    )
    const totalNet = payslips.reduce((acc, p) => acc + p.netPay, 0)
    return {
      headcount: payslips.length,
      totalGross,
      totalGovAndTax,
      totalNet,
    }
  }, [payslips])

  const triggerDownload = (url: string, filename: string) => {
    const token = localStorage.getItem("payroll_token")
    fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
      .catch((err) => setError(err.message))
  }

  // -------------------------------------------------------------
  // Data Table Column Definitions
  // -------------------------------------------------------------
  const payslipColumns = useMemo<ColumnDef<PayslipListItem>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs text-foreground">{row.original.employeeName}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{row.original.employeeCode}</div>
          </div>
        ),
      },
      {
        accessorKey: "jobTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department / Role" />,
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="text-foreground">{row.original.jobTitle}</div>
            <div className="text-[10px] text-muted-foreground">{row.original.departmentName}</div>
          </div>
        ),
      },
      {
        accessorKey: "bankName",
        header: "Bank Account",
        cell: ({ row }) => (
          <div className="text-xs font-mono text-[11px]">
            <div>{row.original.bankName || "Unassigned"}</div>
            <div className="text-[10px] text-muted-foreground">{row.original.bankAccountNumber || "N/A"}</div>
          </div>
        ),
      },
      {
        accessorKey: "basicPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Basic Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums font-mono">
            ₱{formatCurrency(row.original.basicPay)}
          </div>
        ),
      },
      {
        accessorKey: "grossPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gross Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-medium tabular-nums font-mono">
            ₱{formatCurrency(row.original.grossPay)}
          </div>
        ),
      },
      {
        accessorKey: "totalEmployeeContributions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gov't Contrib" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-amber-500 tabular-nums font-mono">
            -₱{formatCurrency(row.original.totalEmployeeContributions)}
          </div>
        ),
      },
      {
        accessorKey: "withholdingTax",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="W/Tax" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-amber-500 tabular-nums font-mono">
            -₱{formatCurrency(row.original.withholdingTax)}
          </div>
        ),
      },
      {
        accessorKey: "netPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Net Take-Home" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-bold text-primary tabular-nums font-mono">
            ₱{formatCurrency(row.original.netPay)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Payslip</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              onClick={() => openPayslipDetail(row.original.payrollItemId)}
            >
              <EyeIcon className="mr-1 size-3" />
              View Payslip
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const registerColumns = useMemo<ColumnDef<PayslipListItem>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("employeeCode")}</span>,
      },
      {
        accessorKey: "employeeName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("employeeName")}</span>,
      },
      {
        accessorKey: "basicPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Basic Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums font-mono">₱{formatCurrency(row.original.basicPay)}</div>
        ),
      },
      {
        accessorKey: "overtimePay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="OT Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums font-mono">₱{formatCurrency(row.original.overtimePay)}</div>
        ),
      },
      {
        accessorKey: "allowances",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Allowances" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums font-mono">₱{formatCurrency(row.original.allowances)}</div>
        ),
      },
      {
        accessorKey: "grossPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gross Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-semibold tabular-nums font-mono">
            ₱{formatCurrency(row.original.grossPay)}
          </div>
        ),
      },
      {
        accessorKey: "attendanceDeductions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Att. Ded" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-destructive tabular-nums font-mono">
            {row.original.attendanceDeductions > 0 ? `-₱${formatCurrency(row.original.attendanceDeductions)}` : "₱0.00"}
          </div>
        ),
      },
      {
        accessorKey: "totalEmployeeContributions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="EE Contrib" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-amber-500 tabular-nums font-mono">
            -₱{formatCurrency(row.original.totalEmployeeContributions)}
          </div>
        ),
      },
      {
        accessorKey: "withholdingTax",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="W/Tax" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-amber-500 tabular-nums font-mono">
            -₱{formatCurrency(row.original.withholdingTax)}
          </div>
        ),
      },
      {
        accessorKey: "otherDeductions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Other Ded" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs text-destructive tabular-nums font-mono">
            {row.original.otherDeductions > 0 ? `-₱${formatCurrency(row.original.otherDeductions)}` : "₱0.00"}
          </div>
        ),
      },
      {
        accessorKey: "netPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Net Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-bold text-primary tabular-nums font-mono">
            ₱{formatCurrency(row.original.netPay)}
          </div>
        ),
      },
    ],
    []
  )

  const bankColumns = useMemo<ColumnDef<DisbursementLine>[]>(
    () => [
      {
        accessorKey: "bankName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bank" />,
        cell: ({ row }) => <span className="font-semibold text-xs">{row.getValue("bankName")}</span>,
      },
      {
        accessorKey: "bankAccountNumber",
        header: "Account Number",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">{row.getValue("bankAccountNumber")}</span>
        ),
      },
      {
        accessorKey: "employeeName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account Name" />,
        cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("employeeName")}</span>,
      },
      {
        accessorKey: "remarks",
        header: "Description / Reference",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">
            {row.original.remarks} ({row.original.employeeCode})
          </span>
        ),
      },
      {
        accessorKey: "netPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Disbursement Amount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold text-primary text-xs tabular-nums font-mono">
            ₱{formatCurrency(row.original.netPay)}
          </div>
        ),
      },
    ],
    []
  )

  const statutoryColumns = useMemo<ColumnDef<StatutoryRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee Name" />,
        cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("name")}</span>,
      },
      {
        accessorKey: "idNumber",
        header: `${statutoryType} ID Number`,
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("idNumber")}</span>,
      },
      ...(statutoryType !== "BIR"
        ? [
            {
              accessorKey: "monthlyCompensation",
              header: () => <div className="text-right">Monthly Salary</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs tabular-nums font-mono">
                  ₱{formatCurrency(row.original.monthlyCompensation)}
                </div>
              ),
            },
            {
              accessorKey: "employeeShare",
              header: () => <div className="text-right">EE Share</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs font-medium text-amber-500 tabular-nums font-mono">
                  ₱{formatCurrency(row.original.employeeShare)}
                </div>
              ),
            },
            {
              accessorKey: "employerShare",
              header: () => <div className="text-right">ER Share</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs text-muted-foreground tabular-nums font-mono">
                  ₱{formatCurrency(row.original.employerShare)}
                </div>
              ),
            },
            {
              accessorKey: "total",
              header: () => <div className="text-right">Total Remittance</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs font-bold text-primary tabular-nums font-mono">
                  ₱{formatCurrency(row.original.total)}
                </div>
              ),
            },
          ]
        : [
            {
              accessorKey: "grossCompensation",
              header: () => <div className="text-right">Gross Pay</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs tabular-nums font-mono">
                  ₱{formatCurrency(row.original.grossCompensation)}
                </div>
              ),
            },
            {
              accessorKey: "nonTaxableExempt",
              header: () => <div className="text-right">Non-Taxable / Exempt</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs text-muted-foreground tabular-nums font-mono">
                  ₱{formatCurrency(row.original.nonTaxableExempt)}
                </div>
              ),
            },
            {
              accessorKey: "taxableCompensation",
              header: () => <div className="text-right">Taxable Income</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs tabular-nums font-mono">
                  ₱{formatCurrency(row.original.taxableCompensation)}
                </div>
              ),
            },
            {
              accessorKey: "taxWithheld",
              header: () => <div className="text-right">Tax Withheld</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right text-xs font-bold text-primary tabular-nums font-mono">
                  ₱{formatCurrency(row.original.taxWithheld)}
                </div>
              ),
            },
          ]),
    ],
    [statutoryType]
  )

  const journalColumns = useMemo<ColumnDef<JournalEntry>[]>(
    () => [
      {
        accessorKey: "accountCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.getValue("accountCode")}</span>
        ),
      },
      {
        accessorKey: "accountTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account Title / Description" />,
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="font-medium">{row.original.accountTitle}</div>
            <div className="text-[11px] text-muted-foreground">{row.original.description}</div>
          </div>
        ),
      },
      {
        accessorKey: "debit",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Debit (₱)" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-xs tabular-nums font-mono">
            {row.original.debit > 0
              ? `₱${row.original.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "credit",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Credit (₱)" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-xs tabular-nums text-primary font-mono">
            {row.original.credit > 0
              ? `₱${row.original.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "—"}
          </div>
        ),
      },
    ],
    []
  )

  const filteredDisbursementLines = useMemo(() => {
    if (!bankData?.disbursementLines) return []
    if (selectedBankFilter === "ALL") return bankData.disbursementLines
    return bankData.disbursementLines.filter((l) => l.bankName === selectedBankFilter)
  }, [bankData, selectedBankFilter])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Header Selector & Summary Bar */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Payslips & Financial Reports Hub</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                Phase 6
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Generate official employee digital payslips, master payroll registers, corporate bank batch files, and government remittance reports.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Cutoff:</span>
              <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-9 min-w-[260px] text-xs font-medium">
                  <SelectValue placeholder="Select payroll cutoff..." />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.code} — {p.name} [{p.status}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  triggerDownload(
                    `/api/reports/payroll-register/csv?periodId=${selectedPeriod.id}`,
                    `PayrollRegister_${selectedPeriod.code}.csv`
                  )
                }
              >
                <DownloadIcon className="mr-1.5 size-3.5" />
                Master Register (CSV)
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Multi-Tab Reports & Payslips Console */}
      {selectedPeriod && (
        <Tabs defaultValue="payslips" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:w-auto">
            <TabsTrigger value="payslips" className="gap-1.5 text-xs">
              <FileTextIcon className="size-3.5" />
              Employee Payslips ({payslips.length.toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5 text-xs">
              <FileSpreadsheetIcon className="size-3.5" />
              Master Payroll Register
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-1.5 text-xs">
              <BanknoteIcon className="size-3.5" />
              Bank Disbursement Batch
            </TabsTrigger>
            <TabsTrigger value="statutory" className="gap-1.5 text-xs">
              <LandmarkIcon className="size-3.5" />
              Statutory Remittances
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-1.5 text-xs">
              <CoinsIcon className="size-3.5" />
              Accounting Journal
            </TabsTrigger>
          </TabsList>

          {/* ========================================================== */}
          {/* TAB 1: INDIVIDUAL EMPLOYEE PAYSLIPS                         */}
          {/* ========================================================== */}
          <TabsContent value="payslips" className="space-y-4">
            {/* Period KPI Summary Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Active Payslips
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums font-mono">
                      {periodKpis.headcount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Cutoff: {selectedPeriod.startDate} – {selectedPeriod.endDate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <UsersIcon className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Period Gross Payroll
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums font-mono text-foreground">
                      ₱{formatCurrency(periodKpis.totalGross)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Basic + Overtime + Allowances
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                    <CoinsIcon className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Gov&apos;t &amp; Withholding Tax
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums font-mono text-amber-500">
                      -₱{formatCurrency(periodKpis.totalGovAndTax)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      SSS, PhilHealth, Pag-IBIG &amp; BIR TRAIN
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-500">
                    <ShieldCheckIcon className="size-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Total Net Disbursement
                    </div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums font-mono text-primary">
                      ₱{formatCurrency(periodKpis.totalNet)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Pay Date: {selectedPeriod.payDate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
                    <WalletIcon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Employee Payslip Directory — {selectedPeriod.name}
                </CardTitle>
                <CardDescription>
                  Search and inspect digital payslips formatted for official printing or PDF download.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <DataTable
                  columns={payslipColumns}
                  data={payslips}
                  searchPlaceholder="Search employees by name, code, or department..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 2: MASTER PAYROLL REGISTER                              */}
          {/* ========================================================== */}
          <TabsContent value="register" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Master Payroll Register</CardTitle>
                  <CardDescription>
                    Complete line item breakdown across all employees with spreadsheet CSV export.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    triggerDownload(
                      `/api/reports/payroll-register/csv?periodId=${selectedPeriod.id}`,
                      `PayrollRegister_${selectedPeriod.code}.csv`
                    )
                  }
                >
                  <DownloadIcon className="mr-1.5 size-3.5" />
                  Export Master Register (CSV)
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={registerColumns}
                  data={payslips}
                  searchPlaceholder="Filter master register..."
                  footerContent={
                    payslips.length > 0 ? (
                      <TableRow className="border-t-2 font-semibold">
                        <TableCell colSpan={2} className="font-bold text-xs">
                          Cutoff Grand Totals ({payslips.length.toLocaleString()} Employees)
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums font-mono">
                          ₱
                          {payslips
                            .reduce((a, b) => a + b.basicPay, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums font-mono">
                          ₱
                          {payslips
                            .reduce((a, b) => a + b.overtimePay, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums font-mono">
                          ₱
                          {payslips
                            .reduce((a, b) => a + b.allowances, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums font-mono">
                          ₱
                          {payslips
                            .reduce((a, b) => a + b.grossPay, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-destructive tabular-nums font-mono">
                          -₱
                          {payslips
                            .reduce((a, b) => a + b.attendanceDeductions, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-amber-500 tabular-nums font-mono">
                          -₱
                          {payslips
                            .reduce((a, b) => a + b.totalEmployeeContributions, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-amber-500 tabular-nums font-mono">
                          -₱
                          {payslips
                            .reduce((a, b) => a + b.withholdingTax, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-destructive tabular-nums font-mono">
                          -₱
                          {payslips
                            .reduce((a, b) => a + b.otherDeductions, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-primary tabular-nums font-mono">
                          ₱
                          {payslips
                            .reduce((a, b) => a + b.netPay, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 3: BANK DISBURSEMENT BATCH FILES                        */}
          {/* ========================================================== */}
          <TabsContent value="bank" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Bank Batch Disbursement Advice</CardTitle>
                  <CardDescription>
                    Direct salary credits batch format for Philippine commercial banks (BDO, BPI, Metrobank, UnionBank, LandBank).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      triggerDownload(
                        `/api/reports/bank-disbursement/csv?periodId=${selectedPeriod.id}&bankName=${selectedBankFilter}`,
                        `BankBatch_${selectedBankFilter}_${selectedPeriod.code}.csv`
                      )
                    }
                  >
                    <DownloadIcon className="mr-1.5 size-3.5" />
                    Download Bank Batch File (.CSV)
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Bank Breakdown Summary Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {bankData?.bankSummaries.map((b) => (
                    <div
                      key={b.bankName}
                      onClick={() => setSelectedBankFilter(b.bankName)}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        selectedBankFilter === b.bankName
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "bg-muted/30 hover:border-primary/50"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>{b.bankName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {b.headcount}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-bold text-primary tabular-nums font-mono">
                        ₱{b.totalDisbursement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Disbursement Table with DataTable */}
                <DataTable
                  columns={bankColumns}
                  data={filteredDisbursementLines}
                  searchPlaceholder="Filter bank disbursements by account or employee..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 4: STATUTORY COMPLIANCE REMITTANCE SCHEDULES            */}
          {/* ========================================================== */}
          <TabsContent value="statutory" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Government Statutory Remittance Reports</CardTitle>
                  <CardDescription>
                    Official monthly compliance schedules for SSS, PhilHealth, Pag-IBIG (HDMF), and BIR 1601-C.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      triggerDownload(
                        `/api/reports/statutory/csv?periodId=${selectedPeriod.id}&type=${statutoryType}`,
                        `Statutory_${statutoryType}_${selectedPeriod.code}.csv`
                      )
                    }
                  >
                    <DownloadIcon className="mr-1.5 size-3.5" />
                    Download {statutoryType} Schedule (CSV)
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Agency Switcher */}
                <div className="flex flex-wrap gap-2">
                  {(["SSS", "PHILHEALTH", "PAGIBIG", "BIR"] as const).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={statutoryType === type ? "default" : "outline"}
                      onClick={() => handleStatutoryTypeChange(type)}
                    >
                      {type === "SSS"
                        ? "SSS (Form R-3)"
                        : type === "PHILHEALTH"
                        ? "PhilHealth (RF-1)"
                        : type === "PAGIBIG"
                        ? "Pag-IBIG HDMF (MCRF)"
                        : "BIR 1601-C Withholding"}
                    </Button>
                  ))}
                </div>

                {statutoryData && (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border bg-muted/20 p-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Compliance Form</div>
                        <div className="text-sm font-semibold">{statutoryData.form}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Governing Agency</div>
                        <div className="text-sm font-semibold">{statutoryData.agency}</div>
                      </div>
                      {statutoryType !== "BIR" ? (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground">Total Employee Share</div>
                            <div className="text-base font-bold text-amber-500 tabular-nums font-mono">
                              ₱{(statutoryData.totalEmployeeShare ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Grand Remittance (EE + ER)</div>
                            <div className="text-base font-bold text-primary tabular-nums font-mono">
                              ₱{(statutoryData.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground">Taxable Compensation</div>
                            <div className="text-base font-bold tabular-nums font-mono">
                              ₱{(statutoryData.totalTaxable ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Total Tax Withheld</div>
                            <div className="text-base font-bold text-primary tabular-nums font-mono">
                              ₱{(statutoryData.totalTaxWithheld ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Remittance Detail Table with DataTable */}
                    <DataTable
                      columns={statutoryColumns}
                      data={statutoryData.records}
                      searchPlaceholder={`Filter ${statutoryType} remittance records...`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 5: DOUBLE-ENTRY ACCOUNTING JOURNAL VOUCHER              */}
          {/* ========================================================== */}
          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      General Ledger Accounting Journal Voucher ({journalData?.journalNumber})
                    </CardTitle>
                    {journalData?.isBalanced && (
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        <CheckCircle2Icon className="mr-1 size-3 inline" />
                        Balanced (Debits = Credits)
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Posting Date: {journalData?.postingDate} • Cutoff: {journalData?.cutoffDate}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={journalColumns}
                  data={journalData?.entries ?? []}
                  searchPlaceholder="Filter journal entries by account code or title..."
                  footerContent={
                    journalData ? (
                      <TableRow className="border-t-2 font-semibold">
                        <TableCell colSpan={2} className="font-bold text-xs uppercase tracking-wider">
                          Voucher Ledger Totals
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums font-mono">
                          ₱{(journalData?.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs tabular-nums text-primary font-mono">
                          ₱{(journalData?.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ============================================================ */}
      {/* DIALOG: PRINTABLE DIGITAL PAYSLIP MODAL                     */}
      {/* ============================================================ */}
      <Dialog open={Boolean(activePayslip)} onOpenChange={() => setActivePayslip(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:border-none print:shadow-none">
          {/* Interactive Modal Toolbar (Hidden when printing) */}
          <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b bg-background/95 px-5 py-3.5 backdrop-blur print:hidden">
            <div className="flex items-center gap-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileTextIcon className="size-4 text-primary" />
                <span>Official Digital Payslip</span>
              </DialogTitle>
              {activePayslipIndex !== -1 && payslips.length > 0 && (
                <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={loadingPayslip || payslips.length <= 1}
                    onClick={() => handleNavigatePayslip("prev")}
                    title="Previous Employee (Left Arrow)"
                  >
                    <ChevronLeftIcon className="size-3.5" />
                    Prev
                  </Button>
                  <span className="px-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {activePayslipIndex + 1} / {payslips.length.toLocaleString()}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={loadingPayslip || payslips.length <= 1}
                    onClick={() => handleNavigatePayslip("next")}
                    title="Next Employee (Right Arrow)"
                  >
                    Next
                    <ChevronRightIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mr-6">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-8 gap-1.5 text-xs"
              >
                <PrinterIcon className="size-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          {activePayslip && (
            <div className="space-y-4 p-5 sm:p-6 bg-card text-card-foreground print:p-2 print:space-y-3">
              {/* ZONE 1: CORPORATE LETTERHEAD & PAY PERIOD METADATA */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-primary/20 pb-4 gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Building2Icon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-extrabold tracking-tight uppercase text-foreground">
                        ACME ENTERPRISE PHILIPPINES, INC.
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Corporate Center, Bonifacio Global City, Taguig, Metro Manila, Philippines
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="default" className="text-[10px] uppercase tracking-wider font-semibold">
                        Official Payslip &amp; Advice of Credit
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono uppercase ${
                          activePayslip.periodStatus === "Finalized" || activePayslip.periodStatus === "Approved"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {activePayslip.periodStatus}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-auto rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs sm:text-right">
                  <div className="flex sm:justify-end items-center gap-1.5 font-mono font-bold text-foreground">
                    <CalendarIcon className="size-3.5 text-primary" />
                    <span>PERIOD: {activePayslip.periodCode}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {activePayslip.payFrequency} (Cutoff #{activePayslip.cutoffSlot})
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Cutoff Coverage:{" "}
                    <span className="font-medium text-foreground">
                      {activePayslip.startDate} to {activePayslip.endDate}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Payout / Credit Date:{" "}
                    <span className="font-mono font-semibold text-primary">
                      {activePayslip.payDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZONE 2: TWO-COLUMN EMPLOYEE PROFILE, RATES & STATUTORY IDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Left Card: Employee Profile & Rate Breakdown */}
                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[11px] text-muted-foreground">
                      <UserCheckIcon className="size-3.5 text-primary" />
                      Employee Profile &amp; Base Rates
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {activePayslip.employee.employmentStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Employee Name</span>
                      <span className="font-bold text-foreground text-xs">{activePayslip.employee.fullName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Employee Code</span>
                      <span className="font-mono font-semibold text-foreground">{activePayslip.employee.employeeCode}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Department</span>
                      <span className="font-medium text-foreground">{activePayslip.employee.department}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Designation / Role</span>
                      <span className="font-medium text-foreground">{activePayslip.employee.jobTitle}</span>
                    </div>
                  </div>

                  {/* Base Rate Pill Bar */}
                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-background/80 p-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Monthly Basic</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(activePayslip.employee.basicMonthlySalary)}
                      </div>
                    </div>
                    <div className="border-x px-1">
                      <div className="text-[10px] text-muted-foreground">Daily Rate</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(activePayslip.employee.dailyRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Hourly Rate</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(activePayslip.employee.hourlyRate)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Statutory IDs & Disbursement Bank Account */}
                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[11px] text-muted-foreground">
                      <CreditCardIcon className="size-3.5 text-primary" />
                      Statutory Numbers &amp; Bank Account
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">PH Compliance</span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">TIN Number</span>
                      <span className="font-mono font-medium text-foreground">
                        {activePayslip.employee.tinNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">SSS Number</span>
                      <span className="font-mono font-medium text-foreground">
                        {activePayslip.employee.sssNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">PhilHealth Pin</span>
                      <span className="font-mono font-medium text-foreground">
                        {activePayslip.employee.philHealthNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Pag-IBIG MID</span>
                      <span className="font-mono font-medium text-foreground">
                        {activePayslip.employee.pagIbigNumber || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Bank Disbursement Pill */}
                  <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Payroll Credit Account</div>
                      <div className="font-mono font-semibold text-[11px] text-foreground">
                        {activePayslip.employee.bankName || "Bank"} • {activePayslip.employee.bankAccountNumber || "N/A"}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Direct Credit
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ZONE 3: TIMEKEEPING & ATTENDANCE SUMMARY BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Days Worked</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {activePayslip.attendance.daysWorked.toLocaleString("en-US", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}{" "}
                      days
                    </div>
                  </div>
                  <ClockIcon className="size-4 text-primary/70" />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Overtime Hours</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        activePayslip.attendance.overtimeHours > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {formatCurrency(activePayslip.attendance.overtimeHours)} hrs
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    +₱{formatCurrency(activePayslip.attendance.overtimePay)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Late / Undertime</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        activePayslip.attendance.lateUndertimeMinutes > 0
                          ? "text-amber-500"
                          : "text-foreground"
                      }`}
                    >
                      {activePayslip.attendance.lateUndertimeMinutes.toLocaleString()} mins
                    </div>
                  </div>
                  {activePayslip.attendance.lateUndertimeDeduction > 0 && (
                    <span className="font-mono text-[10px] text-destructive tabular-nums">
                      -₱{formatCurrency(activePayslip.attendance.lateUndertimeDeduction)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Unpaid Absences</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        activePayslip.attendance.absentDays > 0 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {activePayslip.attendance.absentDays} days
                    </div>
                  </div>
                  {activePayslip.attendance.absenceDeduction > 0 && (
                    <span className="font-mono text-[10px] text-destructive tabular-nums">
                      -₱{formatCurrency(activePayslip.attendance.absenceDeduction)}
                    </span>
                  )}
                </div>
              </div>

              {/* ZONE 4: SIDE-BY-SIDE ITEMIZED LEDGER (EARNINGS VS DEDUCTIONS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Gross Earnings */}
                <div className="flex flex-col justify-between rounded-lg border overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between bg-emerald-500/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b">
                      <span>Gross Earnings &amp; Perks</span>
                      <span className="font-mono text-[10px]">Amount (PHP)</span>
                    </div>
                    <div className="divide-y divide-border/50 px-3.5 py-1.5 text-xs">
                      {activePayslip.earningLines.map((line, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                              {line.groupName}
                            </Badge>
                            <span className="font-medium text-foreground truncate">{line.description}</span>
                          </div>
                          <span className="font-semibold tabular-nums font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                            +₱{formatCurrency(line.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t-2 bg-muted/40 px-3.5 py-2.5 flex items-center justify-between text-xs font-bold">
                    <span className="uppercase tracking-wide">Total Gross Earnings</span>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                      ₱{formatCurrency(activePayslip.financials.grossPay)}
                    </span>
                  </div>
                </div>

                {/* Right Column: Deductions & Statutory Withholdings */}
                <div className="flex flex-col justify-between rounded-lg border overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between bg-destructive/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-destructive border-b">
                      <span>Deductions &amp; Statutory Withholdings</span>
                      <span className="font-mono text-[10px]">Amount (PHP)</span>
                    </div>
                    <div className="divide-y divide-border/50 px-3.5 py-1.5 text-xs">
                      {activePayslip.deductionLines.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground">
                          No deductions recorded for this cutoff.
                        </div>
                      ) : (
                        activePayslip.deductionLines.map((line, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                                  {line.groupName}
                                </Badge>
                                <span className="font-medium text-foreground truncate">{line.description}</span>
                              </div>
                              {line.employerShare > 0 && (
                                <div className="mt-0.5 text-[10px] text-muted-foreground font-mono pl-1">
                                  Employer (ER) Counterpart: ₱{formatCurrency(line.employerShare)}
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-destructive tabular-nums font-mono shrink-0">
                              -₱{formatCurrency(line.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border-t-2 bg-muted/40 px-3.5 py-2.5 flex items-center justify-between text-xs font-bold">
                    <span className="uppercase tracking-wide">Total Deductions</span>
                    <span className="text-sm text-destructive tabular-nums font-mono">
                      -₱{formatCurrency(activePayslip.financials.totalDeductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZONE 5: NET TAKE-HOME PAY HERO BANNER + TAXABLE & EMPLOYER SHARE BREAKDOWN */}
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <WalletIcon className="size-4 text-primary" />
                      <span className="text-xs uppercase font-bold tracking-wider text-primary">
                        Net Take-Home Pay (Disbursement Amount)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Credited to <span className="font-semibold text-foreground">{activePayslip.employee.bankName}</span>{" "}
                      Account <span className="font-mono font-semibold text-foreground">#{activePayslip.employee.bankAccountNumber}</span>{" "}
                      on <span className="font-medium text-foreground">{activePayslip.payDate}</span>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-primary tabular-nums font-mono">
                    ₱{formatCurrency(activePayslip.financials.netPay)}
                  </div>
                </div>

                {/* 3-Column Financial & Statutory Sub-Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-primary/20 pt-2.5 text-xs">
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Taxable Income (TRAIN)</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ₱{formatCurrency(activePayslip.financials.taxableIncome)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Employee Gov&apos;t Share (EE)</span>
                    <span className="font-mono font-semibold text-amber-500 tabular-nums">
                      ₱{formatCurrency(activePayslip.financials.totalEmployeeContributions)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Employer Gov&apos;t Share (ER)</span>
                    <span className="font-mono font-semibold text-primary tabular-nums">
                      ₱{formatCurrency(activePayslip.financials.totalEmployerContributions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZONE 6: ACKNOWLEDGMENT & OFFICIAL SIGNATURE / VERIFICATION FOOTER */}
              <div className="border-t pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-end text-[11px] text-muted-foreground gap-4">
                <div className="space-y-0.5 max-w-md">
                  <div className="font-semibold text-foreground">
                    Employee Compensation &amp; Remittance Acknowledgment
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    I hereby acknowledge receipt of the Net Take-Home Pay stated above as full settlement of my compensation for Payroll Period{" "}
                    <span className="font-mono font-medium text-foreground">{activePayslip.periodCode}</span>.
                  </p>
                </div>
                <div className="flex gap-8 w-full sm:w-auto justify-end pt-2">
                  <div className="text-center">
                    <div className="border-b border-muted-foreground/60 w-36 pb-4"></div>
                    <div className="text-[10px] mt-1 font-medium">Prepared &amp; Verified By (Payroll)</div>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-muted-foreground/60 w-36 pb-4"></div>
                    <div className="text-[10px] mt-1 font-medium">
                      {activePayslip.employee.fullName} (Employee)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t bg-muted/20 px-5 py-3 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setActivePayslip(null)}>
              Close
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <PrinterIcon className="mr-1.5 size-4" />
              Print Official Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
