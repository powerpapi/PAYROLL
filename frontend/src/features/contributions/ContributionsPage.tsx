import React, { useEffect, useState } from "react"
import {
  CalculatorIcon,
  FunctionSquareIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
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
import { apiFetch } from "@/lib/api"

interface ContributionLine {
  code: string
  name: string
  formulaSummary: string
  employeeShare: number
  employerShare: number
  employerEcShare: number
}

interface PreviewResponse {
  monthlySalary: number
  asOfDate: string
  totalEmployeeShare: number
  totalEmployerShare: number
  monthlyTaxableIncome: number
  estimatedMonthlyTax: number
  matchedTaxBracket: string
  appliedTaxFormula: string
  estimatedMonthlyNetPay: number
  contributions: ContributionLine[]
}

interface ContributionBracketItem {
  id?: string
  minCompensation: number
  maxCompensation: number | null
  monthlySalaryCredit: number
  employeeShare: number
  employerShare: number
  employerEcShare: number
}

interface ContributionScheduleItem {
  id: string
  effectiveFrom: string
  effectiveTo?: string | null
  calculationMode: number
  employeeRatePercent: number
  employerRatePercent: number
  fixedEmployeeAmount: number
  fixedEmployerAmount: number
  salaryFloor?: number | null
  salaryCeiling?: number | null
  employeeFormula?: string | null
  employerFormula?: string | null
  brackets: ContributionBracketItem[]
}

interface ContributionTypeItem {
  id: string
  code: string
  name: string
  description?: string | null
  isSystemDefault: boolean
  isActive: boolean
  isTaxDeductible: boolean
  schedules: ContributionScheduleItem[]
}

interface TaxBracketItem {
  id: string
  bracketName: string
  effectiveFrom: string
  minMonthlyIncome: number
  maxMonthlyIncome: number | null
  baseTax: number
  excessOverAmount: number
  excessRatePercent: number
  taxFormula?: string | null
}

const MODE_LABELS: Record<number, string> = {
  1: "Fixed Amount",
  2: "Percentage (Floor/Ceiling)",
  3: "Bracket Lookup Table",
  4: "Custom Formula Expression",
}

export function ContributionsPage() {
  const [salary, setSalary] = useState(35000)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [types, setTypes] = useState<ContributionTypeItem[]>([])
  const [taxBrackets, setTaxBrackets] = useState<TaxBracketItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Add New Contribution Form
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [eeRate, setEeRate] = useState(2.0)
  const [erRate, setErRate] = useState(2.0)
  const [floor, setFloor] = useState(0)
  const [ceiling, setCeiling] = useState(50000)
  const [newEeFormula, setNewEeFormula] = useState(
    "clamp(salary, floor, ceiling) * (ee_rate / 100)"
  )
  const [newErFormula, setNewErFormula] = useState(
    "clamp(salary, floor, ceiling) * (er_rate / 100)"
  )

  // Edit Schedule / Formula Modal State
  const [editingType, setEditingType] = useState<ContributionTypeItem | null>(null)
  const [editScheduleId, setEditScheduleId] = useState<string>("")
  const [editMode, setEditMode] = useState<number>(4)
  const [editEeRate, setEditEeRate] = useState<number>(2.5)
  const [editErRate, setEditErRate] = useState<number>(2.5)
  const [editFixedEe, setEditFixedEe] = useState<number>(0)
  const [editFixedEr, setEditFixedEr] = useState<number>(0)
  const [editFloor, setEditFloor] = useState<string>("10000")
  const [editCeiling, setEditCeiling] = useState<string>("100000")
  const [editEeFormula, setEditEeFormula] = useState<string>("")
  const [editErFormula, setEditErFormula] = useState<string>("")
  const [editBrackets, setEditBrackets] = useState<ContributionBracketItem[]>([])
  const [formulaTestResult, setFormulaTestResult] = useState<{
    employeeShare: number
    employerShare: number
  } | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Edit Tax Bracket Modal State
  const [editingTaxBracket, setEditingTaxBracket] = useState<TaxBracketItem | null>(null)
  const [taxForm, setTaxForm] = useState({
    bracketName: "",
    effectiveFrom: "2025-01-01",
    minMonthlyIncome: 0,
    maxMonthlyIncome: "",
    baseTax: 0,
    excessOverAmount: 0,
    excessRatePercent: 15,
    taxFormula: "base_tax + max(0, taxable - excess_over) * (rate / 100)",
  })

  const loadAll = async (targetSalary = salary) => {
    setError(null)
    try {
      const [previewData, typesData, taxData] = await Promise.all([
        apiFetch<PreviewResponse>(
          `/api/contributions/preview?monthlySalary=${targetSalary}`
        ),
        apiFetch<ContributionTypeItem[]>("/api/contributions"),
        apiFetch<TaxBracketItem[]>("/api/contributions/tax-brackets"),
      ])
      setPreview(previewData)
      setTypes(typesData)
      setTaxBrackets(taxData)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadAll(salary)
  }, [])

  const openEditModal = (t: ContributionTypeItem) => {
    const activeSched = t.schedules[0]
    if (!activeSched) return

    setEditingType(t)
    setEditScheduleId(activeSched.id)
    setEditMode(activeSched.calculationMode)
    setEditEeRate(activeSched.employeeRatePercent)
    setEditErRate(activeSched.employerRatePercent)
    setEditFixedEe(activeSched.fixedEmployeeAmount)
    setEditFixedEr(activeSched.fixedEmployerAmount)
    setEditFloor(
      activeSched.salaryFloor !== null && activeSched.salaryFloor !== undefined
        ? String(activeSched.salaryFloor)
        : ""
    )
    setEditCeiling(
      activeSched.salaryCeiling !== null && activeSched.salaryCeiling !== undefined
        ? String(activeSched.salaryCeiling)
        : ""
    )
    setEditEeFormula(
      activeSched.employeeFormula ||
        "clamp(salary, floor, ceiling) * (ee_rate / 100)"
    )
    setEditErFormula(
      activeSched.employerFormula ||
        "clamp(salary, floor, ceiling) * (er_rate / 100)"
    )
    setEditBrackets(activeSched.brackets.map((b) => ({ ...b })))
    setFormulaTestResult(null)
  }

  const openTaxModal = (tb: TaxBracketItem) => {
    setEditingTaxBracket(tb)
    setTaxForm({
      bracketName: tb.bracketName,
      effectiveFrom: tb.effectiveFrom,
      minMonthlyIncome: tb.minMonthlyIncome,
      maxMonthlyIncome:
        tb.maxMonthlyIncome !== null && tb.maxMonthlyIncome !== undefined
          ? String(tb.maxMonthlyIncome)
          : "",
      baseTax: tb.baseTax,
      excessOverAmount: tb.excessOverAmount,
      excessRatePercent: tb.excessRatePercent,
      taxFormula:
        tb.taxFormula || "base_tax + max(0, taxable - excess_over) * (rate / 100)",
    })
  }

  const handleSaveTaxBracket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTaxBracket) return
    setError(null)
    try {
      await apiFetch(`/api/contributions/tax-brackets/${editingTaxBracket.id}`, {
        method: "PUT",
        body: JSON.stringify({
          bracketName: taxForm.bracketName,
          effectiveFrom: taxForm.effectiveFrom,
          minMonthlyIncome: Number(taxForm.minMonthlyIncome),
          maxMonthlyIncome:
            taxForm.maxMonthlyIncome === "" ? null : Number(taxForm.maxMonthlyIncome),
          baseTax: Number(taxForm.baseTax),
          excessOverAmount: Number(taxForm.excessOverAmount),
          excessRatePercent: Number(taxForm.excessRatePercent),
          taxFormula: taxForm.taxFormula,
        }),
      })
      setEditingTaxBracket(null)
      await loadAll(salary)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleTestFormula = async () => {
    setError(null)
    try {
      const res = await apiFetch<{ employeeShare: number; employerShare: number }>(
        "/api/contributions/test-formula",
        {
          method: "POST",
          body: JSON.stringify({
            monthlySalary: Number(salary),
            employeeRatePercent: Number(editEeRate),
            employerRatePercent: Number(editErRate),
            fixedEmployeeAmount: Number(editFixedEe),
            fixedEmployerAmount: Number(editFixedEr),
            salaryFloor: editFloor === "" ? null : Number(editFloor),
            salaryCeiling: editCeiling === "" ? null : Number(editCeiling),
            employeeFormula: editEeFormula,
            employerFormula: editErFormula,
          }),
        }
      )
      setFormulaTestResult(res)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editScheduleId) return
    setSavingSchedule(true)
    setError(null)
    try {
      await apiFetch(`/api/contributions/schedules/${editScheduleId}`, {
        method: "PUT",
        body: JSON.stringify({
          calculationMode: editMode,
          employeeRatePercent: Number(editEeRate),
          employerRatePercent: Number(editErRate),
          fixedEmployeeAmount: Number(editFixedEe),
          fixedEmployerAmount: Number(editFixedEr),
          salaryFloor: editFloor === "" ? null : Number(editFloor),
          salaryCeiling: editCeiling === "" ? null : Number(editCeiling),
          employeeFormula: editMode === 4 ? editEeFormula : null,
          employerFormula: editMode === 4 ? editErFormula : null,
          brackets: editMode === 3 ? editBrackets : null,
        }),
      })
      setEditingType(null)
      await loadAll(salary)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleAddCustomContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/contributions", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          description: "Custom statutory contribution with editable formula",
          isTaxDeductible: true,
          effectiveFrom: "2025-01-01",
          calculationMode: 4,
          employeeRatePercent: Number(eeRate),
          employerRatePercent: Number(erRate),
          fixedEmployeeAmount: 0,
          fixedEmployerAmount: 0,
          salaryFloor: Number(floor) || 0,
          salaryCeiling: Number(ceiling) || null,
          employeeFormula: newEeFormula,
          employerFormula: newErFormula,
        }),
      })
      setCode("")
      setName("")
      await loadAll(salary)
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

      {/* ============================================================ */}
      {/* CARD 1: CONFIGURED CONTRIBUTIONS & FORMULA EDITOR            */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Government Contributions & Formulas</CardTitle>
          <CardDescription>
            Click "Edit Formula / Rules" on any contribution (SSS, PhilHealth, Pag-IBIG, or Custom) to modify its mathematical formula, rates, floor/ceiling, or bracket table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Contribution Name</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Active Formula / Rule</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => {
                  const sched = t.schedules[0]
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {t.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.isSystemDefault ? "Default Statutory" : "Custom Statutory"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {sched ? MODE_LABELS[sched.calculationMode] : "None"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {sched?.calculationMode === 4 || sched?.employeeFormula ? (
                          <div>
                            <div>
                              <span className="font-semibold text-foreground">EE:</span>{" "}
                              {sched.employeeFormula}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">ER:</span>{" "}
                              {sched.employerFormula}
                            </div>
                          </div>
                        ) : sched?.calculationMode === 3 ? (
                          <span>{sched.brackets.length} Salary Brackets Configured</span>
                        ) : sched?.calculationMode === 1 ? (
                          <span>
                            Fixed EE ₱{sched.fixedEmployeeAmount} / ER ₱
                            {sched.fixedEmployerAmount}
                          </span>
                        ) : (
                          <span>
                            {sched?.employeeRatePercent}% EE / {sched?.employerRatePercent}% ER
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(t)}
                        >
                          <PencilIcon className="mr-1.5 size-3.5" />
                          Edit Formula / Rules
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* CARD 2: DYNAMIC GRADUATED WITHHOLDING TAX BRACKETS           */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Dynamic Graduated Withholding Tax Brackets & Formulas</CardTitle>
          <CardDescription>
            Effective-dated tax brackets evaluated by the Payroll Calculation Engine. Click "Edit Tax Rule" to customize bracket ranges, rates, or tax formula expressions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bracket</TableHead>
                  <TableHead>Monthly Taxable Range</TableHead>
                  <TableHead className="text-right">Base Tax</TableHead>
                  <TableHead className="text-right">Excess Rate</TableHead>
                  <TableHead>Tax Formula</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxBrackets.map((tb) => (
                  <TableRow key={tb.id}>
                    <TableCell className="font-medium">{tb.bracketName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      ₱{tb.minMonthlyIncome.toLocaleString()} –{" "}
                      {tb.maxMonthlyIncome
                        ? `₱${tb.maxMonthlyIncome.toLocaleString()}`
                        : "Above"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ₱{tb.baseTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tb.excessRatePercent}% over ₱{tb.excessOverAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tb.taxFormula}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTaxModal(tb)}
                      >
                        <PencilIcon className="mr-1.5 size-3.5" />
                        Edit Tax Rule
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* CARD 3: LIVE SALARY, CONTRIBUTION & TAX SIMULATOR            */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Live Contribution & Tax Formula Simulator</CardTitle>
          <CardDescription>
            Enter any monthly basic salary to evaluate all active statutory formulas, withholding tax brackets, and estimated net pay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Monthly Basic Salary (₱)</Label>
              <Input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-48"
              />
            </div>
            <Button onClick={() => loadAll(salary)}>
              <CalculatorIcon className="mr-1.5 size-4" />
              Evaluate Formulas
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Contribution / Tax</TableHead>
                    <TableHead>Evaluated Formula / Rule</TableHead>
                    <TableHead className="text-right">Employee Share / Deduction</TableHead>
                    <TableHead className="text-right">Employer Share</TableHead>
                    <TableHead className="text-right">Employer EC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.contributions.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {c.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.formulaSummary}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ₱{c.employeeShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₱{c.employerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₱{c.employerEcShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        WTAX
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      Withholding Tax ({preview.matchedTaxBracket})
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {preview.appliedTaxFormula} (Taxable: ₱{preview.monthlyTaxableIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-500 tabular-nums">
                      ₱{preview.estimatedMonthlyTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Estimated Monthly Net Pay (After Statutory EE + Tax)
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary text-base tabular-nums">
                      ₱{preview.estimatedMonthlyNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-bold tabular-nums">
                      Total ER: ₱{preview.totalEmployerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* CARD 4: ADD NEW GOVERNMENT CONTRIBUTION WITH FORMULA         */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Government Contribution with Custom Formula</CardTitle>
          <CardDescription>
            Available variables: <code>salary</code>, <code>basis</code>, <code>floor</code>, <code>ceiling</code>, <code>ee_rate</code>, <code>er_rate</code>, <code>fixed_ee</code>, <code>fixed_er</code>. Functions: <code>min(a,b)</code>, <code>max(a,b)</code>, <code>clamp(x,min,max)</code>, <code>round(x)</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCustomContribution} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  required
                  placeholder="LOCAL_FUND"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Contribution Name *</Label>
                <Input
                  required
                  placeholder="Local Provident Fund"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>EE Rate (ee_rate)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={eeRate}
                  onChange={(e) => setEeRate(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ER Rate (er_rate)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={erRate}
                  onChange={(e) => setErRate(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ceiling (ceiling)</Label>
                <Input
                  type="number"
                  value={ceiling}
                  onChange={(e) => setCeiling(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Employee Share Formula *</Label>
                <Input
                  required
                  className="font-mono text-xs"
                  value={newEeFormula}
                  onChange={(e) => setNewEeFormula(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Employer Share Formula *</Label>
                <Input
                  required
                  className="font-mono text-xs"
                  value={newErFormula}
                  onChange={(e) => setNewErFormula(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit">
              <PlusIcon className="mr-1.5 size-4" />
              Add Dynamic Contribution
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* DIALOG 1: EDIT CONTRIBUTION FORMULA / SCHEDULE               */}
      {/* ============================================================ */}
      <Dialog open={Boolean(editingType)} onOpenChange={() => setEditingType(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FunctionSquareIcon className="size-5 text-primary" />
              Edit Contribution Formula & Schedule — {editingType?.name} ({editingType?.code})
            </DialogTitle>
            <DialogDescription>
              Switch calculation modes or customize the mathematical formula expression.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Calculation Mode</Label>
              <Select
                value={String(editMode)}
                onValueChange={(v) => setEditMode(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">
                    Custom Formula Expression (Editable Math Formula)
                  </SelectItem>
                  <SelectItem value="2">
                    Percentage with Floor & Ceiling
                  </SelectItem>
                  <SelectItem value="1">Fixed Flat Amount</SelectItem>
                  <SelectItem value="3">Salary Bracket Lookup Table</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editMode !== 3 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>EE Rate % (ee_rate)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editEeRate}
                    onChange={(e) => setEditEeRate(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ER Rate % (er_rate)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editErRate}
                    onChange={(e) => setEditErRate(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary Floor (floor)</Label>
                  <Input
                    type="number"
                    placeholder="None"
                    value={editFloor}
                    onChange={(e) => setEditFloor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Salary Ceiling (ceiling)</Label>
                  <Input
                    type="number"
                    placeholder="None"
                    value={editCeiling}
                    onChange={(e) => setEditCeiling(e.target.value)}
                  />
                </div>
              </div>
            )}

            {editMode === 1 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fixed Employee Amount (fixed_ee)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFixedEe}
                    onChange={(e) => setEditFixedEe(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fixed Employer Amount (fixed_er)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFixedEr}
                    onChange={(e) => setEditFixedEr(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {editMode === 4 && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground">
                    Formula Variables & Functions Reference:
                  </div>
                  <div>
                    • Variables: <code>salary</code>, <code>basis</code>, <code>floor</code>, <code>ceiling</code>, <code>ee_rate</code>, <code>er_rate</code>, <code>fixed_ee</code>, <code>fixed_er</code>
                  </div>
                  <div>
                    • Functions: <code>min(a, b)</code>, <code>max(a, b)</code>, <code>clamp(val, min, max)</code>, <code>round(val)</code>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Employee Share Formula *</Label>
                  <Input
                    required
                    className="font-mono text-xs"
                    value={editEeFormula}
                    onChange={(e) => setEditEeFormula(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Employer Share Formula *</Label>
                  <Input
                    required
                    className="font-mono text-xs"
                    value={editErFormula}
                    onChange={(e) => setEditErFormula(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleTestFormula}
                  >
                    <SparklesIcon className="mr-1.5 size-3.5" />
                    Test Formula on ₱{salary.toLocaleString()}
                  </Button>

                  {formulaTestResult && (
                    <div className="text-xs font-medium">
                      Result → EE:{" "}
                      <span className="font-bold text-primary">
                        ₱{formulaTestResult.employeeShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>{" "}
                      | ER:{" "}
                      <span className="font-bold">
                        ₱{formulaTestResult.employerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editMode === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Salary Brackets</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditBrackets([
                        ...editBrackets,
                        {
                          minCompensation: 0,
                          maxCompensation: null,
                          monthlySalaryCredit: 0,
                          employeeShare: 0,
                          employerShare: 0,
                          employerEcShare: 0,
                        },
                      ])
                    }
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    Add Bracket Row
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Min Salary</TableHead>
                        <TableHead>Max Salary (Blank = Above)</TableHead>
                        <TableHead>Employee Share</TableHead>
                        <TableHead>Employer Share</TableHead>
                        <TableHead>EC Share</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editBrackets.map((b, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={b.minCompensation}
                              onChange={(e) => {
                                const copy = [...editBrackets]
                                copy[idx].minCompensation = Number(e.target.value)
                                setEditBrackets(copy)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="And above"
                              value={b.maxCompensation ?? ""}
                              onChange={(e) => {
                                const copy = [...editBrackets]
                                copy[idx].maxCompensation =
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value)
                                setEditBrackets(copy)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={b.employeeShare}
                              onChange={(e) => {
                                const copy = [...editBrackets]
                                copy[idx].employeeShare = Number(e.target.value)
                                setEditBrackets(copy)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={b.employerShare}
                              onChange={(e) => {
                                const copy = [...editBrackets]
                                copy[idx].employerShare = Number(e.target.value)
                                setEditBrackets(copy)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={b.employerEcShare}
                              onChange={(e) => {
                                const copy = [...editBrackets]
                                copy[idx].employerEcShare = Number(e.target.value)
                                setEditBrackets(copy)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                setEditBrackets(
                                  editBrackets.filter((_, i) => i !== idx)
                                )
                              }
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingType(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingSchedule}>
                {savingSchedule ? "Saving..." : "Save Formula & Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 2: EDIT WITHHOLDING TAX BRACKET & FORMULA             */}
      {/* ============================================================ */}
      <Dialog
        open={Boolean(editingTaxBracket)}
        onOpenChange={() => setEditingTaxBracket(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Withholding Tax Bracket & Formula</DialogTitle>
            <DialogDescription>
              Variables available in Tax Formula: <code>taxable</code>, <code>base_tax</code>, <code>excess_over</code>, <code>rate</code>, <code>min_income</code>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTaxBracket} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bracket Name *</Label>
              <Input
                required
                value={taxForm.bracketName}
                onChange={(e) =>
                  setTaxForm({ ...taxForm, bracketName: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Monthly Taxable (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxForm.minMonthlyIncome}
                  onChange={(e) =>
                    setTaxForm({
                      ...taxForm,
                      minMonthlyIncome: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Monthly Taxable (Blank = Above)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="And above"
                  value={taxForm.maxMonthlyIncome}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, maxMonthlyIncome: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Base Tax (base_tax)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxForm.baseTax}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, baseTax: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Excess Over (excess_over)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxForm.excessOverAmount}
                  onChange={(e) =>
                    setTaxForm({
                      ...taxForm,
                      excessOverAmount: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rate % (rate)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxForm.excessRatePercent}
                  onChange={(e) =>
                    setTaxForm({
                      ...taxForm,
                      excessRatePercent: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tax Formula Expression *</Label>
              <Input
                required
                className="font-mono text-xs"
                value={taxForm.taxFormula}
                onChange={(e) =>
                  setTaxForm({ ...taxForm, taxFormula: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTaxBracket(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Tax Bracket</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
