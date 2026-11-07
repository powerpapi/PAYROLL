import React, { useEffect, useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  BanknoteIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  UserCheckIcon,
  UserPlusIcon,
  Wand2Icon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch } from "@/lib/api"

export interface Department {
  id: string
  code: string
  name: string
  employeeCount?: number
}

export interface AllowanceTypeItem {
  id: string
  code: string
  name: string
  category: string
  groupName: string
  defaultAmount: number
  isTaxable: boolean
  defaultFrequency: string
}

export interface EmployeeAllowanceItem {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  allowanceTypeId?: string | null
  category: string
  groupName: string
  code: string
  name: string
  amount: number
  isTaxable: boolean
  frequency: string
  isActive: boolean
}

export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  middleName?: string
  email: string
  hireDate: string
  jobTitle: string
  employmentStatus: string
  departmentId: string
  departmentName: string
  shiftStartTime?: string
  shiftEndTime?: string
  payFrequency: string
  basicMonthlySalary: number
  dailyRate: number
  hourlyRate: number
  allowanceCount?: number
  monthlyAllowanceTotal?: number
  deductionCount?: number
  monthlyDeductionTotal?: number
  tinNumber?: string
  sssNumber?: string
  philHealthNumber?: string
  pagIbigNumber?: string
  bankName?: string
  bankAccountNumber?: string
  isActive: boolean
}

const BANK_PRESETS = [
  "BDO",
  "BPI",
  "Metrobank",
  "UnionBank",
  "LandBank",
  "Security Bank",
  "RCBC",
  "PNB",
  "Chinabank",
  "Maya Bank",
  "GCash / GXI",
]

const formatCurrency = (val: number) =>
  (val || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatNumberWithCommas = (raw: string | number): string => {
  const str = String(raw).replace(/[^0-9.]/g, "")
  if (!str) return ""
  const parts = str.split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0]
}

const parseFormattedNumber = (formatted: string): number => {
  const cleaned = formatted.replace(/,/g, "")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

const emptyForm = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  hireDate: new Date().toISOString().split("T")[0],
  employmentStatus: "Regular",
  jobTitle: "",
  departmentId: "",
  shiftStartTime: "09:00",
  shiftEndTime: "18:00",
  payFrequency: "SemiMonthly",
  basicMonthlySalary: 30000,
  tinNumber: "",
  sssNumber: "",
  philHealthNumber: "",
  pagIbigNumber: "",
  bankName: "BDO",
  bankAccountNumber: "",
  isActive: true,
}

const PAGE_SIZE = 50

export function EmployeesPage({ canEdit }: { canEdit: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceTypeItem[]>([])
  const [search, setSearch] = useState("")
  const [selectedDept, setSelectedDept] = useState("ALL")
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Employee Profile Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [salaryInput, setSalaryInput] = useState("30,000")
  const [alwAmountInput, setAlwAmountInput] = useState("2,000")
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Per-Employee Dynamic Earnings & Deductions Modal
  const [allowanceEmp, setAllowanceEmp] = useState<Employee | null>(null)
  const [empAllowances, setEmpAllowances] = useState<EmployeeAllowanceItem[]>([])
  const [alwForm, setAlwForm] = useState({
    allowanceTypeId: "CUSTOM",
    category: "Earning",
    groupName: "Allowance",
    code: "RICE",
    name: "Rice Subsidy",
    amount: 2000,
    isTaxable: false,
    frequency: "Monthly",
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (selectedDept && selectedDept !== "ALL") {
        params.set("departmentId", selectedDept)
      }

      const [empData, deptData, alwTypes] = await Promise.all([
        apiFetch<Employee[]>(`/api/employees?${params.toString()}`),
        apiFetch<Department[]>("/api/departments"),
        apiFetch<AllowanceTypeItem[]>("/api/payroll/allowances/types"),
      ])
      setEmployees(empData)
      setDepartments(deptData)
      setAllowanceTypes(alwTypes)
      setPage(1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedDept])

  const handleBulkSeed1000 = async () => {
    setSeeding(true)
    setError(null)
    try {
      await apiFetch("/api/employees/seed-bulk?targetCount=1000", {
        method: "POST",
      })
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSeeding(false)
    }
  }

  const handleResetTo30Regular = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all existing employees and reset the system with 30 realistic regular employees (with full attendance logs, leave balances, OT requests, allowances, benefits & loans)?"
      )
    ) {
      return
    }

    setSeeding(true)
    setError(null)
    try {
      await apiFetch("/api/employees/reset-to-thirty-regular", {
        method: "POST",
      })
      setPage(1)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSeeding(false)
    }
  }

  const handleSeedRandomAllowances = async () => {
    setSeeding(true)
    setError(null)
    try {
      await apiFetch("/api/payroll/allowances/seed-random?overwrite=true", {
        method: "POST",
      })
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSeeding(false)
    }
  }

  const openManageAllowances = async (emp: Employee) => {
    setAllowanceEmp(emp)
    const firstType = allowanceTypes[0]
    if (firstType) {
      setAlwForm({
        allowanceTypeId: firstType.id,
        category: firstType.category || "Earning",
        groupName: firstType.groupName || "Allowance",
        code: firstType.code,
        name: firstType.name,
        amount: firstType.defaultAmount,
        isTaxable: firstType.isTaxable,
        frequency: firstType.defaultFrequency,
      })
      setAlwAmountInput(formatNumberWithCommas(firstType.defaultAmount))
    } else {
      setAlwForm({
        allowanceTypeId: "CUSTOM",
        category: "Earning",
        groupName: "Allowance",
        code: "CUSTOM",
        name: "",
        amount: 1000,
        isTaxable: false,
        frequency: "Monthly",
      })
      setAlwAmountInput("1,000")
    }

    try {
      const items = await apiFetch<EmployeeAllowanceItem[]>(
        `/api/payroll/allowances?employeeId=${emp.id}`
      )
      setEmpAllowances(items)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSelectAllowanceType = (typeId: string) => {
    if (typeId === "CUSTOM") {
      setAlwForm({
        allowanceTypeId: "CUSTOM",
        category: "Earning",
        groupName: "Allowance",
        code: "CUSTOM",
        name: "",
        amount: 1000,
        isTaxable: false,
        frequency: "Monthly",
      })
      setAlwAmountInput("1,000")
      return
    }
    const found = allowanceTypes.find((t) => t.id === typeId)
    if (found) {
      setAlwForm({
        allowanceTypeId: found.id,
        category: found.category || "Earning",
        groupName: found.groupName || "Allowance",
        code: found.code,
        name: found.name,
        amount: found.defaultAmount,
        isTaxable: found.isTaxable,
        frequency: found.defaultFrequency,
      })
      setAlwAmountInput(formatNumberWithCommas(found.defaultAmount))
    }
  }

  const handleAddEmployeeAllowance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allowanceEmp) return
    setError(null)
    try {
      await apiFetch("/api/payroll/allowances", {
        method: "POST",
        body: JSON.stringify({
          employeeId: allowanceEmp.id,
          allowanceTypeId:
            alwForm.allowanceTypeId === "CUSTOM" ? null : alwForm.allowanceTypeId,
          category: alwForm.category,
          groupName: alwForm.groupName,
          code: alwForm.code,
          name: alwForm.name,
          amount: Number(alwForm.amount),
          isTaxable: alwForm.category === "Earning" && alwForm.isTaxable,
          frequency: alwForm.frequency,
          isActive: true,
        }),
      })
      const items = await apiFetch<EmployeeAllowanceItem[]>(
        `/api/payroll/allowances?employeeId=${allowanceEmp.id}`
      )
      setEmpAllowances(items)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteEmployeeAllowance = async (id: string) => {
    if (!allowanceEmp) return
    setError(null)
    try {
      await apiFetch(`/api/payroll/allowances/${id}`, { method: "DELETE" })
      const items = await apiFetch<EmployeeAllowanceItem[]>(
        `/api/payroll/allowances?employeeId=${allowanceEmp.id}`
      )
      setEmpAllowances(items)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const generateNextEmployeeCode = () => {
    let maxNum = 0
    for (const emp of employees) {
      const match = emp.employeeCode.match(/(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }
    return `EMP-${String(maxNum + 1).padStart(4, "0")}`
  }

  const openCreate = () => {
    setEditingId(null)
    setModalError(null)
    const nextCode = generateNextEmployeeCode()
    setForm({
      ...emptyForm,
      employeeCode: nextCode,
      departmentId: departments[0]?.id || "",
    })
    setSalaryInput(formatNumberWithCommas(emptyForm.basicMonthlySalary))
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setModalError(null)
    setForm({
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      middleName: emp.middleName || "",
      email: emp.email,
      hireDate: emp.hireDate,
      employmentStatus: emp.employmentStatus,
      jobTitle: emp.jobTitle,
      departmentId: emp.departmentId,
      shiftStartTime: emp.shiftStartTime || "09:00",
      shiftEndTime: emp.shiftEndTime || "18:00",
      payFrequency: emp.payFrequency,
      basicMonthlySalary: emp.basicMonthlySalary,
      tinNumber: emp.tinNumber || "",
      sssNumber: emp.sssNumber || "",
      philHealthNumber: emp.philHealthNumber || "",
      pagIbigNumber: emp.pagIbigNumber || "",
      bankName: emp.bankName || "BDO",
      bankAccountNumber: emp.bankAccountNumber || "",
      isActive: emp.isActive,
    })
    setSalaryInput(formatNumberWithCommas(emp.basicMonthlySalary))
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalError(null)
    setError(null)
    try {
      const path = editingId ? `/api/employees/${editingId}` : "/api/employees"
      const method = editingId ? "PUT" : "POST"
      await apiFetch(path, {
        method,
        body: JSON.stringify({
          ...form,
          basicMonthlySalary: Number(form.basicMonthlySalary),
        }),
      })
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      setModalError(err.message)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Live computed rates for the Create/Edit Employee dialog
  const computedDailyRate = useMemo(
    () => (Number(form.basicMonthlySalary) * 12) / 261,
    [form.basicMonthlySalary]
  )
  const computedHourlyRate = useMemo(
    () => computedDailyRate / 8,
    [computedDailyRate]
  )
  const computedCutoffBase = useMemo(() => {
    const monthly = Number(form.basicMonthlySalary) || 0
    if (form.payFrequency === "Monthly") return monthly
    if (form.payFrequency === "Weekly") return (monthly * 12) / 52
    return monthly / 2
  }, [form.basicMonthlySalary, form.payFrequency])

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.getValue("employeeCode")}
          </span>
        ),
      },
      {
        id: "employeeName",
        accessorFn: (row) => `${row.lastName}, ${row.firstName} ${row.middleName || ""}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">
              {row.original.lastName}, {row.original.firstName} {row.original.middleName || ""}
            </div>
            <div className="text-[11px] text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: "departmentName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal">
            {row.getValue("departmentName")}
          </Badge>
        ),
      },
      {
        accessorKey: "jobTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Job Title" />,
        cell: ({ row }) => <span className="font-medium">{row.getValue("jobTitle")}</span>,
      },
      {
        accessorKey: "shift",
        id: "shift",
        header: "Shift Schedule",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.shiftStartTime || "09:00"}–{row.original.shiftEndTime || "18:00"}
          </span>
        ),
      },
      {
        accessorKey: "basicMonthlySalary",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Basic Salary" className="justify-end" />
        ),
        cell: ({ row }) => {
          const val = row.original.basicMonthlySalary
          return (
            <div className="text-right font-medium font-mono tabular-nums">
              ₱{formatCurrency(val)}
              <div className="text-[10px] font-normal text-muted-foreground">
                ₱{formatCurrency(row.original.dailyRate)}/day
              </div>
            </div>
          )
        },
      },
      {
        id: "perks",
        header: () => <div className="text-right">Monthly Perks & Ded</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-[11px] font-mono">
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              +₱{(row.original.monthlyAllowanceTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-red-500">
              -₱{(row.original.monthlyDeductionTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "employmentStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
          >
            {row.getValue("employmentStatus")}
          </Badge>
        ),
      },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Actions</div>,
              cell: ({ row }: { row: any }) => (
                <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openManageAllowances(row.original)}
                    className="h-7 text-xs px-2"
                  >
                    <CoinsIcon className="mr-1 size-3.5 text-primary" />
                    Perks
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(row.original)}
                    className="h-7 text-xs px-2"
                  >
                    <PencilIcon className="mr-1 size-3.5" />
                    Edit
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canEdit, departments]
  )

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedDept !== "ALL" && emp.departmentId !== selectedDept) {
        return false
      }
      return true
    })
  }, [employees, selectedDept])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Employee Directory & Compensation</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {employees.length.toLocaleString()} Total
              </Badge>
            </div>
            <CardDescription>
              Interactive TanStack Data Table with multi-column sorting, column visibility toggles, and per-employee earnings/deductions.
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={seeding}
                onClick={handleResetTo30Regular}
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <SparklesIcon className="mr-1.5 size-4 text-emerald-500" />
                {seeding ? "Resetting to 30..." : "Reset to 30 Regular Employees"}
              </Button>
              {employees.length < 1000 && (
                <Button
                  variant="outline"
                  disabled={seeding}
                  onClick={handleBulkSeed1000}
                >
                  <SparklesIcon className="mr-1.5 size-4 text-primary" />
                  {seeding ? "Generating 1,000..." : "Generate 1,000 Employees"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={seeding}
                onClick={handleSeedRandomAllowances}
              >
                <SparklesIcon className="mr-1.5 size-4 text-primary" />
                {seeding ? "Seeding Allowances..." : "Seed Random Allowances (All)"}
              </Button>
              <Button onClick={openCreate}>
                <PlusIcon className="mr-1.5 size-4" />
                Add Employee
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Interactive TanStack Data Table */}
          <DataTable
            columns={columns}
            data={filteredEmployees}
            searchPlaceholder="Filter employees by name, code, email, title..."
            isLoading={loading}
            initialPageSize={10}
            onRowClick={canEdit ? (emp) => openEdit(emp) : undefined}
            filterElement={
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Departments
                  </SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* DIALOG 1: MANAGE DYNAMIC PER-EMPLOYEE EARNINGS & DEDUCTIONS  */}
      {/* ============================================================ */}
      <Dialog
        open={Boolean(allowanceEmp)}
        onOpenChange={() => setAllowanceEmp(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CoinsIcon className="size-5 text-primary" />
              Dynamic Earnings & Deductions — {allowanceEmp?.lastName}, {allowanceEmp?.firstName} ({allowanceEmp?.employeeCode})
            </DialogTitle>
            <DialogDescription>
              Assign recurring Earnings (Allowances, Bonuses, Incentives) and Deductions (Cash Advances, Loans, HMO Share, Other Deductions) for this employee.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleAddEmployeeAllowance}
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
          >
            <div className="text-xs font-semibold text-foreground">
              + Assign Dynamic Earning or Deduction to {allowanceEmp?.firstName}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Catalog Preset</Label>
                <Select
                  value={alwForm.allowanceTypeId}
                  onValueChange={handleSelectAllowanceType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowanceTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        [{t.category}] {t.name} ({t.code})
                      </SelectItem>
                    ))}
                    <SelectItem value="CUSTOM">+ Custom Component...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Top-Level Category *</Label>
                <Select
                  value={alwForm.category}
                  onValueChange={(v) =>
                    setAlwForm({
                      ...alwForm,
                      category: v,
                      groupName: v === "Deduction" ? "Loan & Cash Advance" : "Allowance",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Earning">Earning (+ Add to Pay)</SelectItem>
                    <SelectItem value="Deduction">Deduction (- Subtract from Pay)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Sub-Group *</Label>
                <Select
                  value={alwForm.groupName}
                  onValueChange={(v) => setAlwForm({ ...alwForm, groupName: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alwForm.category === "Deduction" ? (
                      <>
                        <SelectItem value="Loan & Cash Advance">Loan & Cash Advance</SelectItem>
                        <SelectItem value="Benefit Deduction">Benefit / HMO Deduction</SelectItem>
                        <SelectItem value="Other Deduction">Other Deduction</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Allowance">Allowance</SelectItem>
                        <SelectItem value="Bonus & Incentive">Bonus & Incentive</SelectItem>
                        <SelectItem value="Other Earning">Other Earning</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  required
                  value={alwForm.code}
                  onChange={(e) => setAlwForm({ ...alwForm, code: e.target.value })}
                  placeholder="RICE / CASH_ADV"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Component Name *</Label>
                <Input
                  required
                  value={alwForm.name}
                  onChange={(e) => setAlwForm({ ...alwForm, name: e.target.value })}
                  placeholder="e.g. Rice Subsidy"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Amount (₱) *</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    ₱
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    required
                    className="pl-6 font-mono tabular-nums"
                    value={alwAmountInput}
                    onChange={(e) => {
                      const formatted = formatNumberWithCommas(e.target.value)
                      setAlwAmountInput(formatted)
                      setAlwForm({
                        ...alwForm,
                        amount: parseFormattedNumber(formatted),
                      })
                    }}
                    placeholder="2,000.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={alwForm.frequency}
                  onValueChange={(v) => setAlwForm({ ...alwForm, frequency: v })}
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

            <div className="flex items-center justify-between pt-1">
              {alwForm.category === "Earning" ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="empAlwTaxable"
                    checked={alwForm.isTaxable}
                    onCheckedChange={(c) =>
                      setAlwForm({ ...alwForm, isTaxable: Boolean(c) })
                    }
                  />
                  <Label htmlFor="empAlwTaxable" className="text-xs">
                    Taxable Earning (leave unchecked for Non-Taxable / De Minimis)
                  </Label>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Deductions are subtracted from Net Take-Home Pay during payroll runs.
                </div>
              )}

              <Button type="submit" size="sm">
                <PlusIcon className="mr-1.5 size-4" />
                Add {alwForm.category}
              </Button>
            </div>
          </form>

          {/* Grouped View: EARNINGS vs DEDUCTIONS */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* EARNINGS GROUP */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-primary/10 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Earnings Group
                </span>
                <Badge variant="default" className="text-[10px]">
                  {empAllowances.filter((x) => x.category !== "Deduction").length} Item(s)
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empAllowances.filter((x) => x.category !== "Deduction").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                        No recurring earnings assigned.
                      </TableCell>
                    </TableRow>
                  ) : (
                    empAllowances
                      .filter((x) => x.category !== "Deduction")
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.code} • {item.isTaxable ? "Taxable" : "De Minimis"} ({item.frequency})
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {item.groupName || "Allowance"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-primary tabular-nums">
                            +₱{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => handleDeleteEmployeeAllowance(item.id)}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* DEDUCTIONS GROUP */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-destructive/10 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                  Deductions Group
                </span>
                <Badge variant="destructive" className="text-[10px]">
                  {empAllowances.filter((x) => x.category === "Deduction").length} Item(s)
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empAllowances.filter((x) => x.category === "Deduction").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                        No recurring deductions assigned.
                      </TableCell>
                    </TableRow>
                  ) : (
                    empAllowances
                      .filter((x) => x.category === "Deduction")
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.code} ({item.frequency})
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {item.groupName || "Other Deduction"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-destructive tabular-nums">
                            -₱{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => handleDeleteEmployeeAllowance(item.id)}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 2: CREATE / EDIT EMPLOYEE PROFILE                     */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {editingId ? (
                    <UserCheckIcon className="size-5" />
                  ) : (
                    <UserPlusIcon className="size-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {editingId ? "Edit Employee Profile" : "Add New Employee"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Configure identity, department placement, compensation rates, and Philippine statutory records.
                  </DialogDescription>
                </div>
              </div>
              {editingId && (
                <Badge
                  variant={form.isActive ? "default" : "secondary"}
                  className={
                    form.isActive
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 w-fit"
                      : "w-fit"
                  }
                >
                  {form.isActive ? "Active Employee" : "Inactive / Separated"}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 px-6 py-5">
            {modalError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
              >
                {modalError}
              </div>
            )}

            {/* SECTION 1: IDENTITY & PERSONAL DETAILS */}
            <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <UserPlusIcon className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    1. Identity & Personal Information
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Fields marked with * are required
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="space-y-1.5 sm:col-span-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emp-code">Employee Code *</Label>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            employeeCode: generateNextEmployeeCode(),
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        title="Generate next sequential employee code"
                      >
                        <Wand2Icon className="size-3" />
                        Auto
                      </button>
                    )}
                  </div>
                  <Input
                    id="emp-code"
                    required
                    className="font-mono"
                    value={form.employeeCode}
                    onChange={(e) =>
                      setForm({ ...form, employeeCode: e.target.value.toUpperCase() })
                    }
                    placeholder="EMP-0031"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-8">
                  <Label htmlFor="emp-email">Work Email Address *</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="firstname.lastname@payroll.local"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-first-name">First Name *</Label>
                  <Input
                    id="emp-first-name"
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    placeholder="e.g. Juan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-middle-name">Middle Name</Label>
                  <Input
                    id="emp-middle-name"
                    value={form.middleName}
                    onChange={(e) =>
                      setForm({ ...form, middleName: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-last-name">Last Name *</Label>
                  <Input
                    id="emp-last-name"
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    placeholder="e.g. Dela Cruz"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: ORGANIZATION & WORK SCHEDULE */}
            <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <Building2Icon className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    2. Organization & Work Schedule
                  </h3>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  <ClockIcon className="mr-1 size-3 text-muted-foreground" />
                  Shift: {form.shiftStartTime || "09:00"} – {form.shiftEndTime || "18:00"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-dept">Department *</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => setForm({ ...form, departmentId: v })}
                  >
                    <SelectTrigger id="emp-dept">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-job-title">Job Title / Designation *</Label>
                  <Input
                    id="emp-job-title"
                    required
                    value={form.jobTitle}
                    onChange={(e) =>
                      setForm({ ...form, jobTitle: e.target.value })
                    }
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-status">Employment Status *</Label>
                  <Select
                    value={form.employmentStatus}
                    onValueChange={(v) =>
                      setForm({ ...form, employmentStatus: v })
                    }
                  >
                    <SelectTrigger id="emp-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Probationary">Probationary</SelectItem>
                      <SelectItem value="Contractual">Contractual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-hire-date">Date Hired *</Label>
                  <Input
                    id="emp-hire-date"
                    type="date"
                    required
                    value={form.hireDate}
                    onChange={(e) =>
                      setForm({ ...form, hireDate: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-shift-start">Shift Start Time</Label>
                  <Input
                    id="emp-shift-start"
                    type="time"
                    value={form.shiftStartTime}
                    onChange={(e) =>
                      setForm({ ...form, shiftStartTime: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-shift-end">Shift End Time</Label>
                  <Input
                    id="emp-shift-end"
                    type="time"
                    value={form.shiftEndTime}
                    onChange={(e) =>
                      setForm({ ...form, shiftEndTime: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: COMPENSATION & LIVE RATE PREVIEW */}
            <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <BanknoteIcon className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    3. Compensation & Live Rate Breakdown
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  261 working days/year • 8 hours/day standard
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-salary">Basic Monthly Salary (₱) *</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      ₱
                    </span>
                    <Input
                      id="emp-salary"
                      type="text"
                      inputMode="decimal"
                      required
                      className="pl-7 font-mono text-sm font-semibold tabular-nums"
                      value={salaryInput}
                      onChange={(e) => {
                        const formatted = formatNumberWithCommas(e.target.value)
                        setSalaryInput(formatted)
                        setForm({
                          ...form,
                          basicMonthlySalary: parseFormattedNumber(formatted),
                        })
                      }}
                      placeholder="30,000.00"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-pay-freq">Payroll Cutoff Frequency</Label>
                  <Select
                    value={form.payFrequency}
                    onValueChange={(v) => setForm({ ...form, payFrequency: v })}
                  >
                    <SelectTrigger id="emp-pay-freq">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SemiMonthly">
                        Semi-Monthly (1st & 2nd Cutoff)
                      </SelectItem>
                      <SelectItem value="Monthly">Monthly (Single Cutoff)</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live Rate Calculation Preview Banner */}
              <div className="grid grid-cols-1 gap-2.5 rounded-lg border bg-muted/40 p-3 sm:grid-cols-3">
                <div className="rounded-md bg-background/80 p-2.5 border border-border/60">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Per-Cutoff Basic Pay
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums">
                    ₱{formatCurrency(computedCutoffBase)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {form.payFrequency === "SemiMonthly"
                      ? "50% of monthly basic"
                      : form.payFrequency === "Weekly"
                      ? "Weekly equivalent"
                      : "100% monthly"}
                  </div>
                </div>

                <div className="rounded-md bg-background/80 p-2.5 border border-border/60">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Computed Daily Rate
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-foreground tabular-nums">
                    ₱{formatCurrency(computedDailyRate)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    (Monthly × 12) ÷ 261 days
                  </div>
                </div>

                <div className="rounded-md bg-background/80 p-2.5 border border-border/60">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Computed Hourly Rate
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-foreground tabular-nums">
                    ₱{formatCurrency(computedHourlyRate)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Daily Rate ÷ 8 hours
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: STATUTORY NUMBERS & BANK DISBURSEMENT */}
            <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <LandmarkIcon className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    4. Philippine Statutory IDs & Bank Disbursement
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Used for SSS, PhilHealth, Pag-IBIG, BIR 2316 & Bank Batch CSV
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-tin">BIR TIN</Label>
                  <Input
                    id="emp-tin"
                    className="font-mono text-xs"
                    value={form.tinNumber}
                    onChange={(e) =>
                      setForm({ ...form, tinNumber: e.target.value })
                    }
                    placeholder="000-000-000-000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-sss">SSS Number</Label>
                  <Input
                    id="emp-sss"
                    className="font-mono text-xs"
                    value={form.sssNumber}
                    onChange={(e) =>
                      setForm({ ...form, sssNumber: e.target.value })
                    }
                    placeholder="34-0000000-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-philhealth">PhilHealth PIN</Label>
                  <Input
                    id="emp-philhealth"
                    className="font-mono text-xs"
                    value={form.philHealthNumber}
                    onChange={(e) =>
                      setForm({ ...form, philHealthNumber: e.target.value })
                    }
                    placeholder="12-000000000-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-pagibig">Pag-IBIG MID</Label>
                  <Input
                    id="emp-pagibig"
                    className="font-mono text-xs"
                    value={form.pagIbigNumber}
                    onChange={(e) =>
                      setForm({ ...form, pagIbigNumber: e.target.value })
                    }
                    placeholder="1210-0000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-bank-name">Disbursement Bank</Label>
                  <Select
                    value={
                      BANK_PRESETS.includes(form.bankName)
                        ? form.bankName
                        : form.bankName
                        ? "CUSTOM"
                        : "BDO"
                    }
                    onValueChange={(v) => {
                      if (v !== "CUSTOM") {
                        setForm({ ...form, bankName: v })
                      } else {
                        setForm({ ...form, bankName: "" })
                      }
                    }}
                  >
                    <SelectTrigger id="emp-bank-name">
                      <SelectValue placeholder="Select Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANK_PRESETS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                      <SelectItem value="CUSTOM">Other / Custom Bank...</SelectItem>
                    </SelectContent>
                  </Select>
                  {!BANK_PRESETS.includes(form.bankName) && (
                    <Input
                      className="mt-1.5"
                      value={form.bankName}
                      onChange={(e) =>
                        setForm({ ...form, bankName: e.target.value })
                      }
                      placeholder="Enter custom bank name"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-bank-acct">Bank Account Number</Label>
                  <Input
                    id="emp-bank-acct"
                    className="font-mono"
                    value={form.bankAccountNumber}
                    onChange={(e) =>
                      setForm({ ...form, bankAccountNumber: e.target.value })
                    }
                    placeholder="0010-0000-0000"
                  />
                </div>
              </div>

              {editingId && (
                <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2.5">
                  <div className="space-y-0.5">
                    <Label htmlFor="empActive" className="text-xs font-semibold cursor-pointer">
                      Active Payroll Status
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Uncheck if the employee is separated, resigned, or on inactive payroll hold.
                    </p>
                  </div>
                  <Checkbox
                    id="empActive"
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, isActive: Boolean(checked) })
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t bg-background pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const emp = employees.find((x) => x.id === editingId)
                      if (emp) {
                        setModalOpen(false)
                        openManageAllowances(emp)
                      }
                    }}
                  >
                    <CoinsIcon className="mr-1.5 size-4 text-primary" />
                    Manage Perks & Deductions
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving Employee..."
                    : editingId
                    ? "Update Employee Profile"
                    : "Create Employee"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
