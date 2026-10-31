import React, { useEffect, useState } from "react"
import {
  CalculatorIcon,
  CoinsIcon,
  EyeIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
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
  TableFooter,
  TableHead,
  TableHeader,
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
  const today = new Date().toISOString().split("T")[0]

  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [periodDetail, setPeriodDetail] = useState<PayrollPeriodDetail | null>(null)
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [allowanceModalOpen, setAllowanceModalOpen] = useState(false)
  const [inspectItem, setInspectItem] = useState<PayrollItemDetail | null>(null)

  // Period Form
  const [periodForm, setPeriodForm] = useState({
    code: "2026-11-A",
    name: "Nov 01 – Nov 15, 2026 (1st Cutoff)",
    payFrequency: "SemiMonthly",
    cutoffSlot: 1,
    startDate: today,
    endDate: today,
    payDate: today,
  })

  // Allowance Form
  const [allowanceForm, setAllowanceForm] = useState({
    employeeId: "",
    name: "",
    amount: 2000,
    isTaxable: false,
    frequency: "Monthly",
  })

  const loadOverview = async () => {
    setError(null)
    try {
      const [pData, aData, eData] = await Promise.all([
        apiFetch<PayrollPeriodSummary[]>("/api/payroll/periods"),
        apiFetch<EmployeeAllowance[]>("/api/payroll/allowances"),
        apiFetch<Employee[]>("/api/employees"),
      ])
      setPeriods(pData)
      setAllowances(aData)
      setEmployees(eData)

      const targetId = selectedPeriodId || pData[0]?.id || ""
      if (targetId) {
        setSelectedPeriodId(targetId)
        await loadPeriodDetail(targetId)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadPeriodDetail = async (id: string) => {
    try {
      const detail = await apiFetch<PayrollPeriodDetail>(`/api/payroll/periods/${id}`)
      setPeriodDetail(detail)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  const handleSelectPeriod = async (id: string) => {
    setSelectedPeriodId(id)
    await loadPeriodDetail(id)
  }

  const handleRunComputation = async (id: string) => {
    setComputing(true)
    setError(null)
    try {
      await apiFetch(`/api/payroll/periods/${id}/compute`, {
        method: "POST",
      })
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
      const created = await apiFetch<{ id: string }>("/api/payroll/periods", {
        method: "POST",
        body: JSON.stringify({
          ...periodForm,
          cutoffSlot: Number(periodForm.cutoffSlot),
        }),
      })
      setPeriodModalOpen(false)
      setSelectedPeriodId(created.id)
      await loadOverview()
      await loadPeriodDetail(created.id)
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Period Name</TableHead>
                      <TableHead>Cutoff Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Headcount</TableHead>
                      <TableHead className="text-right">Total Gross</TableHead>
                      <TableHead className="text-right">Total Net Pay</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((p) => (
                      <TableRow
                        key={p.id}
                        className={selectedPeriodId === p.id ? "bg-muted/60" : ""}
                      >
                        <TableCell className="font-mono text-xs font-semibold">
                          {p.code}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.payFrequency} • Pay Date: {p.payDate}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.startDate} → {p.endDate}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.status === "Computed" ? "default" : "secondary"}
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.employeeCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ₱{p.totalGrossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary tabular-nums">
                          ₱{p.totalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectPeriod(p.id)}
                            >
                              Select
                            </Button>
                            {canManage && p.status !== "Finalized" && (
                              <Button
                                size="sm"
                                disabled={computing}
                                onClick={() => handleRunComputation(p.id)}
                              >
                                <PlayIcon className="mr-1 size-3.5" />
                                {computing && selectedPeriodId === p.id
                                  ? "Computing..."
                                  : "Compute Payroll"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Payroll Register for Selected Period */}
          {periodDetail && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      Payroll Register — {periodDetail.name} ({periodDetail.code})
                    </CardTitle>
                    <CardDescription>
                      Click "Breakdown" on any employee to inspect itemized earnings, attendance deductions, dynamic contributions, and tax.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    Status: {periodDetail.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Basic Pay</TableHead>
                        <TableHead className="text-right">OT & Allowances</TableHead>
                        <TableHead className="text-right">Att. Deductions</TableHead>
                        <TableHead className="text-right">Gross Pay</TableHead>
                        <TableHead className="text-right">Gov't Contrib (EE)</TableHead>
                        <TableHead className="text-right">W/Tax</TableHead>
                        <TableHead className="text-right">Net Pay</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodDetail.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                            No payroll items computed yet. Click "Compute Payroll" above to run the engine.
                          </TableCell>
                        </TableRow>
                      ) : (
                        periodDetail.items.map((item) => {
                          const totalAllowances =
                            item.taxableAllowances + item.nonTaxableAllowances
                          const totalAttDed =
                            item.absenceDeduction + item.lateUndertimeDeduction
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">{item.employeeName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.employeeCode} • {item.departmentName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                ₱{item.basicPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                <div>OT: ₱{item.overtimePay.toFixed(2)}</div>
                                <div className="text-muted-foreground">
                                  Alw: ₱{totalAllowances.toFixed(2)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-destructive">
                                {totalAttDed > 0 ? `-₱${totalAttDed.toFixed(2)}` : "₱0.00"}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                ₱{item.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-500">
                                -₱{item.totalEmployeeContributions.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-500">
                                -₱{item.withholdingTax.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary tabular-nums">
                                ₱{item.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setInspectItem(item)}
                                >
                                  <EyeIcon className="mr-1 size-3.5" />
                                  Breakdown
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                    {periodDetail.items.length > 0 && (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} className="font-semibold">
                            Payroll Run Totals ({periodDetail.items.length} Employees)
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            ₱
                            {periodDetail.items
                              .reduce((a, b) => a + b.grossPay, 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            -₱
                            {periodDetail.items
                              .reduce((a, b) => a + b.totalEmployeeContributions, 0)
                              .toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            -₱
                            {periodDetail.items
                              .reduce((a, b) => a + b.withholdingTax, 0)
                              .toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary tabular-nums">
                            ₱
                            {periodDetail.items
                              .reduce((a, b) => a + b.netPay, 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </CardContent>
            </Card>
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Allowance Name</TableHead>
                      <TableHead>Tax Treatment</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.employeeCode}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant={a.isTaxable ? "secondary" : "default"}>
                            {a.isTaxable ? "Taxable" : "De Minimis (Non-Taxable)"}
                          </Badge>
                        </TableCell>
                        <TableCell>{a.frequency}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ₱{a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeleteAllowance(a.id)}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Payroll Computation Breakdown — {inspectItem?.employeeName}
            </DialogTitle>
            <DialogDescription>
              {inspectItem?.employeeCode} • {inspectItem?.jobTitle} ({inspectItem?.departmentName})
            </DialogDescription>
          </DialogHeader>

          {inspectItem && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Employee Amount</TableHead>
                      <TableHead className="text-right">Employer Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspectItem.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {line.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {line.description}
                        </TableCell>
                        <TableCell
                          className={`text-right text-xs font-semibold tabular-nums ${
                            line.amount < 0 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {line.amount < 0
                            ? `-₱${Math.abs(line.amount).toFixed(2)}`
                            : `₱${line.amount.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {line.employerAmount > 0
                            ? `₱${line.employerAmount.toFixed(2)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">
                        Net Take-Home Pay
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary text-base tabular-nums">
                        ₱{inspectItem.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">
                        ER: ₱{inspectItem.totalEmployerContributions.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
