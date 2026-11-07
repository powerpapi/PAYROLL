import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  Building2Icon,
  CalculatorIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  EyeIcon,
  PlayIcon,
  PlusIcon,
  PrinterIcon,
  ShieldCheckIcon,
  Trash2Icon,
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
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Employee } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

const formatCurrency = (val: number | undefined | null) =>
  (val ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

interface PayrollPeriodSummary {
  id: string
  code: string
  name: string
  payFrequency: string
  cutoffSlot: number
  startDate: string
  endDate: string
  payDate: string
  status: string
  computedAtUtc?: string | null
  employeeCount: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
}

interface PayrollItemLine {
  id: string
  lineType: string
  code: string
  description: string
  amount: number
  employerAmount: number
}

interface PayrollItemDetail {
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

interface PayrollPeriodDetail {
  id: string
  code: string
  name: string
  payFrequency: string
  cutoffSlot: number
  startDate: string
  endDate: string
  payDate: string
  status: string
  items: PayrollItemDetail[]
}

interface EmployeeAllowance {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  name: string
  amount: number
  isTaxable: boolean
  frequency: string
}

export function PayrollEnginePage({ canManage }: { canManage: boolean }) {
  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [periodDetail, setPeriodDetail] = useState<PayrollPeriodDetail | null>(null)
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [inspectItem, setInspectItem] = useState<PayrollItemDetail | null>(null)

  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [allowanceModalOpen, setAllowanceModalOpen] = useState(false)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [periodForm, setPeriodForm] = useState({
    code: "",
    name: "",
    payFrequency: "SemiMonthly",
    cutoffSlot: 1,
    startDate: "",
    endDate: "",
    payDate: "",
  })

  const [allowanceForm, setAllowanceForm] = useState({
    employeeId: "",
    name: "",
    amount: 1000,
    isTaxable: false,
    frequency: "Monthly",
  })

  const loadOverview = async () => {
    try {
      const [periodsData, allowancesData, employeesData] = await Promise.all([
        apiFetch<PayrollPeriodSummary[]>("/api/payroll/periods"),
        apiFetch<EmployeeAllowance[]>("/api/payroll/allowances"),
        apiFetch<Employee[]>("/api/employees"),
      ])
      setPeriods(periodsData)
      setAllowances(allowancesData)
      setEmployees(employeesData)

      if (periodsData.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(periodsData[0].id)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadPeriodDetail = async (id: string) => {
    try {
      const data = await apiFetch<PayrollPeriodDetail>(`/api/payroll/periods/${id}`)
      setPeriodDetail(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    if (selectedPeriodId) {
      loadPeriodDetail(selectedPeriodId)
    } else {
      setPeriodDetail(null)
    }
  }, [selectedPeriodId])

  const handleSelectPeriod = (id: string) => {
    setSelectedPeriodId(id)
  }

  const handleRunComputation = async (id: string) => {
    setComputing(true)
    setError(null)
    try {
      await apiFetch(`/api/payroll/periods/${id}/compute`, { method: "POST" })
      await loadOverview()
      await loadPeriodDetail(id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setComputing(false)
    }
  }

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const created = await apiFetch<PayrollPeriodSummary>("/api/payroll/periods", {
        method: "POST",
        body: JSON.stringify({
          ...periodForm,
          cutoffSlot: Number(periodForm.cutoffSlot),
        }),
      })
      setPeriodModalOpen(false)
      await loadOverview()
      setSelectedPeriodId(created.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCreateAllowance = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/payroll/allowances", {
        method: "POST",
        body: JSON.stringify({
          ...allowanceForm,
          amount: Number(allowanceForm.amount),
        }),
      })
      setAllowanceModalOpen(false)
      await loadOverview()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteAllowance = async (id: string) => {
    setError(null)
    try {
      await apiFetch(`/api/payroll/allowances/${id}`, { method: "DELETE" })
      await loadOverview()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const inspectItemIndex = useMemo(() => {
    if (!inspectItem || !periodDetail) return -1
    return periodDetail.items.findIndex((i) => i.id === inspectItem.id)
  }, [inspectItem, periodDetail])

  const handleNavigateInspectItem = (direction: "prev" | "next") => {
    if (!periodDetail || inspectItemIndex === -1 || periodDetail.items.length <= 1) return
    const len = periodDetail.items.length
    const nextIdx =
      direction === "prev"
        ? (inspectItemIndex - 1 + len) % len
        : (inspectItemIndex + 1) % len
    setInspectItem(periodDetail.items[nextIdx])
  }

  useEffect(() => {
    if (!inspectItem || !periodDetail) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handleNavigateInspectItem("prev")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNavigateInspectItem("next")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [inspectItem, inspectItemIndex, periodDetail])

  const inspectEmployee = useMemo(() => {
    if (!inspectItem) return null
    return employees.find((e) => e.id === inspectItem.employeeId) || null
  }, [inspectItem, employees])

  const inspectEarnings = useMemo(() => {
    if (!inspectItem) return []
    return inspectItem.lines.filter((l) => l.amount >= 0)
  }, [inspectItem])

  const inspectDeductions = useMemo(() => {
    if (!inspectItem) return []
    return inspectItem.lines.filter((l) => l.amount < 0)
  }, [inspectItem])

  const inspectTotalDeductions = useMemo(() => {
    if (!inspectItem) return 0
    return inspectDeductions.reduce((acc, l) => acc + Math.abs(l.amount), 0)
  }, [inspectItem, inspectDeductions])

  const periodKpis = useMemo(() => {
    const items = periodDetail?.items ?? []
    const totalGross = items.reduce((acc, p) => acc + p.grossPay, 0)
    const totalGovAndTax = items.reduce(
      (acc, p) => acc + p.totalEmployeeContributions + p.withholdingTax,
      0
    )
    const totalNet = items.reduce((acc, p) => acc + p.netPay, 0)
    return {
      headcount: items.length,
      totalGross,
      totalGovAndTax,
      totalNet,
    }
  }, [periodDetail])

  // -------------------------------------------------------------
  // Data Table Column Definitions (Clean, No Checkboxes)
  // -------------------------------------------------------------
  const periodColumns = useMemo<ColumnDef<PayrollPeriodSummary>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.getValue("code")}</span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Period Name" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.payFrequency} • Pay Date: {row.original.payDate}
            </div>
          </div>
        ),
      },
      {
        id: "cutoffDates",
        header: "Cutoff Dates",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.startDate} → {row.original.endDate}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue("status") as string
          return (
            <Badge
              variant={status === "Computed" ? "default" : "secondary"}
              className={
                status === "Computed"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : "text-[10px]"
              }
            >
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: "employeeCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Headcount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs font-mono">
            {row.original.employeeCount}
          </div>
        ),
      },
      {
        accessorKey: "totalGrossPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Gross" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs font-mono">
            ₱{row.original.totalGrossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "totalNetPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Net Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold text-primary tabular-nums text-xs font-mono">
            ₱{row.original.totalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const p = row.original
          const isSelected = selectedPeriodId === p.id
          return (
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={`h-7 px-2.5 text-xs ${isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => handleSelectPeriod(p.id)}
              >
                {isSelected ? "Selected" : "Select"}
              </Button>
              {canManage && p.status !== "Finalized" && (
                <Button
                  size="sm"
                  disabled={computing}
                  onClick={() => handleRunComputation(p.id)}
                  className="h-7 px-2.5 text-xs"
                >
                  <PlayIcon className="mr-1 size-3" />
                  {computing && selectedPeriodId === p.id ? "Computing..." : "Compute Payroll"}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [selectedPeriodId, canManage, computing]
  )

  const payrollRegisterColumns = useMemo<ColumnDef<PayrollItemDetail>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode} ${row.departmentName}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode} • {row.original.departmentName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "basicPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Basic Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs font-mono">
            ₱{row.original.basicPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        id: "otAndAllowances",
        header: () => <div className="text-right">OT & Allowances</div>,
        cell: ({ row }) => {
          const totalAllowances = row.original.taxableAllowances + row.original.nonTaxableAllowances
          return (
            <div className="text-right text-xs tabular-nums font-mono">
              <div>OT: ₱{row.original.overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-muted-foreground">Alw: ₱{totalAllowances.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          )
        },
      },
      {
        id: "attDeductions",
        header: () => <div className="text-right">Att. Deductions</div>,
        cell: ({ row }) => {
          const totalAttDed = row.original.absenceDeduction + row.original.lateUndertimeDeduction
          return (
            <div className="text-right text-xs tabular-nums font-mono text-destructive">
              {totalAttDed > 0 ? `-₱${totalAttDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}
            </div>
          )
        },
      },
      {
        accessorKey: "grossPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gross Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums text-xs font-mono">
            ₱{row.original.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "totalEmployeeContributions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gov't Contrib (EE)" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-amber-500 text-xs font-mono">
            -₱{row.original.totalEmployeeContributions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "withholdingTax",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="W/Tax" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-amber-500 text-xs font-mono">
            -₱{row.original.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "netPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Net Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold text-primary tabular-nums text-xs font-mono">
            ₱{row.original.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Details</div>,
        cell: ({ row }) => (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setInspectItem(row.original)}
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
            >
              <EyeIcon className="mr-1 size-3.5" />
              Breakdown
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const allowanceColumns = useMemo<ColumnDef<EmployeeAllowance>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">{row.original.employeeCode}</div>
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Allowance Name" />,
        cell: ({ row }) => <span className="font-medium text-xs">{row.original.name}</span>,
      },
      {
        accessorKey: "isTaxable",
        header: "Tax Treatment",
        cell: ({ row }) => (
          <Badge
            variant={row.original.isTaxable ? "secondary" : "default"}
            className={
              !row.original.isTaxable
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                : "text-[10px]"
            }
          >
            {row.original.isTaxable ? "Taxable" : "De Minimis (Non-Taxable)"}
          </Badge>
        ),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.frequency}</span>,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold tabular-nums font-mono text-xs text-primary">
            ₱{row.original.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Actions</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteAllowance(row.original.id)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage]
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="engine" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="engine" className="gap-1.5">
            <CalculatorIcon className="size-4" />
            Payroll Periods & Calculation Engine
          </TabsTrigger>
          <TabsTrigger value="allowances" className="gap-1.5">
            <CoinsIcon className="size-4" />
            Employee Allowances & Adjustments
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: PAYROLL CALCULATION ENGINE                            */}
        {/* ============================================================ */}
        <TabsContent value="engine" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Payroll Periods</CardTitle>
                <CardDescription>
                  Select a pay period and execute the Payroll Calculation Engine to compute Gross Pay, Contributions, Tax, and Net Pay.
                </CardDescription>
              </div>
              {canManage && (
                <Button onClick={() => setPeriodModalOpen(true)}>
                  <PlusIcon className="mr-1.5 size-4" />
                  New Pay Period
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <DataTable
                columns={periodColumns}
                data={periods}
                searchPlaceholder="Search pay periods by code or name..."
              />
            </CardContent>
          </Card>

          {/* Detailed Payroll Register for Selected Period */}
          {periodDetail && (
            <div className="space-y-4">
              {/* Period KPI Summary Strip */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Computed Employees
                      </div>
                      <div className="mt-1 text-xl font-bold tabular-nums font-mono">
                        {periodKpis.headcount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Cutoff: {periodDetail.startDate} – {periodDetail.endDate}
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
                        Pay Date: {periodDetail.payDate}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>
                        Payroll Register — {periodDetail.name} ({periodDetail.code})
                      </CardTitle>
                      <CardDescription>
                        Click &quot;Breakdown&quot; on any employee to inspect itemized earnings, attendance deductions, dynamic contributions, and tax.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      Status: {periodDetail.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={payrollRegisterColumns}
                    data={periodDetail.items}
                    searchPlaceholder="Filter payroll register by employee name, code, or department..."
                    footerContent={
                      periodDetail.items.length > 0 ? (
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell className="font-semibold">
                            Totals ({periodDetail.items.length.toLocaleString()} Employees)
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs">
                            ₱{formatCurrency(periodDetail.items.reduce((a, b) => a + b.basicPay, 0))}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs">
                            ₱
                            {formatCurrency(
                              periodDetail.items.reduce(
                                (a, b) => a + b.overtimePay + b.taxableAllowances + b.nonTaxableAllowances,
                                0
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs text-destructive">
                            -₱
                            {formatCurrency(
                              periodDetail.items.reduce(
                                (a, b) => a + b.absenceDeduction + b.lateUndertimeDeduction,
                                0
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs">
                            ₱{formatCurrency(periodDetail.items.reduce((a, b) => a + b.grossPay, 0))}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs text-amber-500">
                            -₱
                            {formatCurrency(
                              periodDetail.items.reduce((a, b) => a + b.totalEmployeeContributions, 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums font-mono text-xs text-amber-500">
                            -₱
                            {formatCurrency(
                              periodDetail.items.reduce((a, b) => a + b.withholdingTax, 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary tabular-nums font-mono text-xs">
                            ₱{formatCurrency(periodDetail.items.reduce((a, b) => a + b.netPay, 0))}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ) : undefined
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: ALLOWANCES & RECURRING ADJUSTMENTS                    */}
        {/* ============================================================ */}
        <TabsContent value="allowances" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Employee Allowances (Taxable & De Minimis)</CardTitle>
                <CardDescription>
                  Configure recurring monthly or per-cutoff allowances automatically included by the Payroll Calculation Engine.
                </CardDescription>
              </div>
              {canManage && (
                <Button
                  onClick={() => {
                    setAllowanceForm({
                      ...allowanceForm,
                      employeeId: employees[0]?.id || "",
                    })
                    setAllowanceModalOpen(true)
                  }}
                >
                  <PlusIcon className="mr-1.5 size-4" />
                  Add Allowance
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <DataTable
                columns={allowanceColumns}
                data={allowances}
                searchPlaceholder="Search employee allowances..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOG 1: CREATE PAYROLL PERIOD                              */}
      {/* ============================================================ */}
      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payroll Period</DialogTitle>
            <DialogDescription>
              Define the cutoff dates and pay frequency for a new payroll run.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePeriod} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period Code *</Label>
                <Input
                  required
                  value={periodForm.code}
                  onChange={(e) => setPeriodForm({ ...periodForm, code: e.target.value })}
                  placeholder="2026-11-A"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pay Frequency *</Label>
                <Select
                  value={periodForm.payFrequency}
                  onValueChange={(v) => setPeriodForm({ ...periodForm, payFrequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SemiMonthly">Semi-Monthly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Period Name *</Label>
              <Input
                required
                value={periodForm.name}
                onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  required
                  value={periodForm.startDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  required
                  value={periodForm.endDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pay Date *</Label>
                <Input
                  type="date"
                  required
                  value={periodForm.payDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, payDate: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPeriodModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Period</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 2: ADD ALLOWANCE                                      */}
      {/* ============================================================ */}
      <Dialog open={allowanceModalOpen} onOpenChange={setAllowanceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee Allowance</DialogTitle>
            <DialogDescription>
              De Minimis allowances are non-taxable; Taxable allowances are added to taxable income.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAllowance} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={allowanceForm.employeeId}
                onValueChange={(v) => setAllowanceForm({ ...allowanceForm, employeeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employeeCode} — {e.lastName}, {e.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Allowance Name *</Label>
              <Input
                required
                placeholder="e.g. Rice Subsidy, Meal Allowance"
                value={allowanceForm.name}
                onChange={(e) => setAllowanceForm({ ...allowanceForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={allowanceForm.amount}
                  onChange={(e) =>
                    setAllowanceForm({ ...allowanceForm, amount: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency *</Label>
                <Select
                  value={allowanceForm.frequency}
                  onValueChange={(v) => setAllowanceForm({ ...allowanceForm, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly (Split by Cutoff)</SelectItem>
                    <SelectItem value="PerCutoff">Full Amount Per Cutoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="isTaxable"
                checked={allowanceForm.isTaxable}
                onCheckedChange={(c) =>
                  setAllowanceForm({ ...allowanceForm, isTaxable: Boolean(c) })
                }
              />
              <Label htmlFor="isTaxable">
                This allowance is Taxable (uncheck for De Minimis / Non-Taxable)
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllowanceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Allowance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 3: ITEMIZED EMPLOYEE PAYROLL BREAKDOWN                */}
      {/* ============================================================ */}
      <Dialog open={Boolean(inspectItem)} onOpenChange={() => setInspectItem(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:border-none print:shadow-none">
          {/* Interactive Modal Toolbar (Hidden when printing) */}
          <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b bg-background/95 px-5 py-3.5 backdrop-blur print:hidden">
            <div className="flex items-center gap-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalculatorIcon className="size-4 text-primary" />
                <span>Payroll Computation Breakdown</span>
              </DialogTitle>
              {periodDetail && inspectItemIndex !== -1 && periodDetail.items.length > 0 && (
                <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={periodDetail.items.length <= 1}
                    onClick={() => handleNavigateInspectItem("prev")}
                    title="Previous Employee (Left Arrow)"
                  >
                    <ChevronLeftIcon className="size-3.5" />
                    Prev
                  </Button>
                  <span className="px-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {inspectItemIndex + 1} / {periodDetail.items.length.toLocaleString()}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    disabled={periodDetail.items.length <= 1}
                    onClick={() => handleNavigateInspectItem("next")}
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

          {inspectItem && (
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
                        Payroll Engine Computation Sheet
                      </Badge>
                      {periodDetail && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase ${
                            periodDetail.status === "Finalized" ||
                            periodDetail.status === "Approved" ||
                            periodDetail.status === "Computed"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {periodDetail.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {periodDetail && (
                  <div className="w-full sm:w-auto rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs sm:text-right">
                    <div className="flex sm:justify-end items-center gap-1.5 font-mono font-bold text-foreground">
                      <CalendarIcon className="size-3.5 text-primary" />
                      <span>PERIOD: {periodDetail.code}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {periodDetail.payFrequency} (Cutoff #{periodDetail.cutoffSlot})
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Cutoff Coverage:{" "}
                      <span className="font-medium text-foreground">
                        {periodDetail.startDate} to {periodDetail.endDate}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Payout / Credit Date:{" "}
                      <span className="font-mono font-semibold text-primary">
                        {periodDetail.payDate}
                      </span>
                    </div>
                  </div>
                )}
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
                      {inspectEmployee?.employmentStatus || "Regular"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Employee Name</span>
                      <span className="font-bold text-foreground text-xs">{inspectItem.employeeName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Employee Code</span>
                      <span className="font-mono font-semibold text-foreground">{inspectItem.employeeCode}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Department</span>
                      <span className="font-medium text-foreground">{inspectItem.departmentName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Designation / Role</span>
                      <span className="font-medium text-foreground">{inspectItem.jobTitle}</span>
                    </div>
                  </div>

                  {/* Base Rate Pill Bar */}
                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-background/80 p-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Monthly Basic</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(inspectEmployee?.basicMonthlySalary ?? inspectItem.basicPay * 2)}
                      </div>
                    </div>
                    <div className="border-x px-1">
                      <div className="text-[10px] text-muted-foreground">Daily Rate</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(inspectEmployee?.dailyRate ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Hourly Rate</div>
                      <div className="font-mono font-semibold text-[11px] tabular-nums">
                        ₱{formatCurrency(inspectEmployee?.hourlyRate ?? 0)}
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
                        {inspectEmployee?.tinNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">SSS Number</span>
                      <span className="font-mono font-medium text-foreground">
                        {inspectEmployee?.sssNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">PhilHealth Pin</span>
                      <span className="font-mono font-medium text-foreground">
                        {inspectEmployee?.philHealthNumber || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Pag-IBIG MID</span>
                      <span className="font-mono font-medium text-foreground">
                        {inspectEmployee?.pagIbigNumber || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Bank Disbursement Pill */}
                  <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Payroll Credit Account</div>
                      <div className="font-mono font-semibold text-[11px] text-foreground">
                        {inspectEmployee?.bankName || "Bank"} • {inspectEmployee?.bankAccountNumber || "N/A"}
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
                      {inspectItem.daysWorked.toLocaleString("en-US", {
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
                        inspectItem.overtimeHours > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {formatCurrency(inspectItem.overtimeHours)} hrs
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    +₱{formatCurrency(inspectItem.overtimePay)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Late / Undertime</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        inspectItem.lateUndertimeMinutes > 0 ? "text-amber-500" : "text-foreground"
                      }`}
                    >
                      {inspectItem.lateUndertimeMinutes.toLocaleString()} mins
                    </div>
                  </div>
                  {inspectItem.lateUndertimeDeduction > 0 && (
                    <span className="font-mono text-[10px] text-destructive tabular-nums">
                      -₱{formatCurrency(inspectItem.lateUndertimeDeduction)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/15 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Unpaid Absences</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        inspectItem.absentDays > 0 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {inspectItem.absentDays} days
                    </div>
                  </div>
                  {inspectItem.absenceDeduction > 0 && (
                    <span className="font-mono text-[10px] text-destructive tabular-nums">
                      -₱{formatCurrency(inspectItem.absenceDeduction)}
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
                      {inspectEarnings.map((line) => (
                        <div key={line.id} className="flex items-center justify-between py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">
                              {line.code}
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
                      ₱{formatCurrency(inspectItem.grossPay)}
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
                      {inspectDeductions.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground">
                          No deductions recorded for this cutoff.
                        </div>
                      ) : (
                        inspectDeductions.map((line) => (
                          <div key={line.id} className="flex items-center justify-between py-2 gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">
                                  {line.code}
                                </Badge>
                                <span className="font-medium text-foreground truncate">{line.description}</span>
                              </div>
                              {line.employerAmount > 0 && (
                                <div className="mt-0.5 text-[10px] text-muted-foreground font-mono pl-1">
                                  Employer (ER) Counterpart: ₱{formatCurrency(line.employerAmount)}
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-destructive tabular-nums font-mono shrink-0">
                              -₱{formatCurrency(Math.abs(line.amount))}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border-t-2 bg-muted/40 px-3.5 py-2.5 flex items-center justify-between text-xs font-bold">
                    <span className="uppercase tracking-wide">Total Deductions</span>
                    <span className="text-sm text-destructive tabular-nums font-mono">
                      -₱{formatCurrency(inspectTotalDeductions)}
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
                      {inspectEmployee?.bankName ? (
                        <>
                          Credited to <span className="font-semibold text-foreground">{inspectEmployee.bankName}</span>{" "}
                          Account <span className="font-mono font-semibold text-foreground">#{inspectEmployee.bankAccountNumber || "N/A"}</span>
                        </>
                      ) : (
                        <>Computed Net Take-Home Pay for {inspectItem.employeeName}</>
                      )}
                      {periodDetail && (
                        <>
                          {" "}
                          on <span className="font-medium text-foreground">{periodDetail.payDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-primary tabular-nums font-mono">
                    ₱{formatCurrency(inspectItem.netPay)}
                  </div>
                </div>

                {/* 3-Column Financial & Statutory Sub-Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-primary/20 pt-2.5 text-xs">
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Taxable Income (TRAIN)</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ₱{formatCurrency(inspectItem.taxableIncome)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Employee Gov&apos;t Share (EE)</span>
                    <span className="font-mono font-semibold text-amber-500 tabular-nums">
                      ₱{formatCurrency(inspectItem.totalEmployeeContributions)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block rounded bg-background/70 px-2.5 py-1.5 border">
                    <span className="text-[10px] uppercase text-muted-foreground block">Employer Gov&apos;t Share (ER)</span>
                    <span className="font-mono font-semibold text-primary tabular-nums">
                      ₱{formatCurrency(inspectItem.totalEmployerContributions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZONE 6: COMPUTATION AUDIT & VERIFICATION FOOTER */}
              <div className="border-t pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-end text-[11px] text-muted-foreground gap-4">
                <div className="space-y-0.5 max-w-md">
                  <div className="font-semibold text-foreground">
                    Payroll Engine Computation Audit &amp; Verification
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Computed using active Philippine statutory schedules (SSS, PhilHealth, Pag-IBIG HDMF, and BIR TRAIN Law withholding brackets) for period{" "}
                    <span className="font-mono font-medium text-foreground">{periodDetail?.code}</span>.
                  </p>
                </div>
                <div className="flex gap-8 w-full sm:w-auto justify-end pt-2">
                  <div className="text-center">
                    <div className="border-b border-muted-foreground/60 w-36 pb-4"></div>
                    <div className="text-[10px] mt-1 font-medium">Audited &amp; Verified By (Payroll)</div>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-muted-foreground/60 w-36 pb-4"></div>
                    <div className="text-[10px] mt-1 font-medium">
                      {inspectItem.employeeName} (Employee)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t bg-muted/20 px-5 py-3 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setInspectItem(null)}>
              Close
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <PrinterIcon className="mr-1.5 size-4" />
              Print Breakdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
