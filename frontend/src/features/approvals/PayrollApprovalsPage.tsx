import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileCheck2Icon,
  HistoryIcon,
  InfoIcon,
  LockIcon,
  RotateCcwIcon,
  ScaleIcon,
  SendIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api"

export interface ApprovalPeriodSummary {
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
  submittedAtUtc?: string | null
  submittedByEmail?: string | null
  reviewStartedAtUtc?: string | null
  reviewStartedByEmail?: string | null
  approvedAtUtc?: string | null
  approvedByEmail?: string | null
  finalizedAtUtc?: string | null
  finalizedByEmail?: string | null
  rejectionRemarks?: string | null
  employeeCount: number
  totalGrossPay: number
  totalEmployeeContributions: number
  totalEmployerContributions: number
  totalWithholdingTax: number
  totalOtherDeductions: number
  totalNetPay: number
  totalAttendanceDeductions: number
  totalOvertimePay: number
}

export interface MetricComparison {
  metricName: string
  currentValue: number
  previousValue: number
  absoluteChange: number
  percentChange: number
  isIncrease: boolean
}

export interface AnomalyItem {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string
  anomalyType: string
  severity: "Critical" | "Warning" | "Info"
  description: string
  amount: number
}

export interface VarianceReport {
  periodId: string
  code: string
  name: string
  currentStatus: string
  hasPreviousPeriod: boolean
  previousPeriodCode?: string | null
  comparisons: MetricComparison[]
  totalAnomaliesCount: number
  criticalAnomaliesCount: number
  warningAnomaliesCount: number
  anomalies: AnomalyItem[]
}

export interface AuditLogItem {
  id: string
  action: string
  fromStatus: string
  toStatus: string
  userEmail?: string | null
  userRole?: string | null
  remarks?: string | null
  createdAtUtc: string
}

const PIPELINE_STAGES = [
  { key: "Draft", label: "Draft" },
  { key: "Computed", label: "Computed" },
  { key: "PendingReview", label: "Pending Review" },
  { key: "UnderReview", label: "Under Review" },
  { key: "Approved", label: "Approved" },
  { key: "Finalized", label: "Finalized (Locked)" },
]

export function PayrollApprovalsPage({ userRole }: { userRole: string }) {
  const [periods, setPeriods] = useState<ApprovalPeriodSummary[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [variance, setVariance] = useState<VarianceReport | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false)
  const [remarksInput, setRemarksInput] = useState("")

  // Roles permissions
  const isAdmin = userRole === "Admin"
  const isHrOrAdmin = userRole === "Admin" || userRole === "HR"
  const isPayrollOrAdmin =
    userRole === "Admin" || userRole === "PayrollOfficer" || userRole === "HR"

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)

  const loadData = async (targetId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ApprovalPeriodSummary[]>("/api/payroll/approvals")
      setPeriods(data)

      const activeId = targetId || selectedPeriodId || data[0]?.id || ""
      if (activeId) {
        setSelectedPeriodId(activeId)
        await loadPeriodDetails(activeId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodDetails = async (id: string) => {
    try {
      const [vData, aData] = await Promise.all([
        apiFetch<VarianceReport>(`/api/payroll/approvals/${id}/variance`),
        apiFetch<AuditLogItem[]>(`/api/payroll/approvals/${id}/audit-trail`),
      ])
      setVariance(vData)
      setAuditLogs(aData)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSelectPeriod = async (id: string) => {
    setSelectedPeriodId(id)
    setError(null)
    setSuccessMsg(null)
    await loadPeriodDetails(id)
  }

  const executeAction = async (endpoint: string, payload?: any) => {
    if (!selectedPeriodId) return
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await apiFetch(`/api/payroll/approvals/${selectedPeriodId}/${endpoint}`, {
        method: "POST",
        body: payload ? JSON.stringify(payload) : undefined,
      })
      setRemarksInput("")
      setSubmitModalOpen(false)
      setApproveModalOpen(false)
      setRejectModalOpen(false)
      setFinalizeModalOpen(false)
      setSuccessMsg(`Action '${endpoint}' completed successfully.`)
      await loadData(selectedPeriodId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const getStageIndex = (status: string) => {
    if (status === "Rejected") return 1
    return PIPELINE_STAGES.findIndex((s) => s.key === status)
  }

  // -------------------------------------------------------------
  // Data Table Column Definitions
  // -------------------------------------------------------------
  const varianceColumns = useMemo<ColumnDef<MetricComparison>[]>(
    () => [
      {
        accessorKey: "metricName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Financial / Operational Metric" />,
        cell: ({ row }) => (
          <span className="font-medium text-xs text-foreground">{row.getValue("metricName")}</span>
        ),
      },
      {
        accessorKey: "currentValue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Current Cutoff" className="justify-end" />
        ),
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right font-semibold text-xs tabular-nums font-mono">
              {c.metricName === "Headcount"
                ? c.currentValue.toLocaleString()
                : `₱${c.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </div>
          )
        },
      },
      {
        accessorKey: "previousValue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Previous Cutoff" className="justify-end" />
        ),
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right text-xs text-muted-foreground tabular-nums font-mono">
              {c.metricName === "Headcount"
                ? c.previousValue.toLocaleString()
                : `₱${c.previousValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </div>
          )
        },
      },
      {
        accessorKey: "absoluteChange",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Absolute Variance" className="justify-end" />
        ),
        cell: ({ row }) => {
          const c = row.original
          return (
            <div
              className={`text-right text-xs font-semibold tabular-nums font-mono ${
                c.absoluteChange >= 0 ? "text-emerald-500" : "text-destructive"
              }`}
            >
              {c.metricName === "Headcount"
                ? `${c.absoluteChange >= 0 ? "+" : ""}${c.absoluteChange}`
                : `${c.absoluteChange >= 0 ? "+" : "-"}₱${Math.abs(c.absoluteChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </div>
          )
        },
      },
      {
        accessorKey: "percentChange",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Percent Change" className="justify-end" />
        ),
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right text-xs font-bold tabular-nums">
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 ${
                  c.percentChange >= 0
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {c.percentChange >= 0 ? "+" : ""}
                {c.percentChange}%
              </span>
            </div>
          )
        },
      },
    ],
    []
  )

  const anomalyColumns = useMemo<ColumnDef<AnomalyItem>[]>(
    () => [
      {
        accessorKey: "severity",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
        cell: ({ row }) => {
          const severity = row.original.severity
          return (
            <Badge
              variant={
                severity === "Critical"
                  ? "destructive"
                  : severity === "Warning"
                  ? "secondary"
                  : "outline"
              }
              className={`text-[10px] ${
                severity === "Warning" ? "text-amber-500 border-amber-500/30" : ""
              }`}
            >
              {severity}
            </Badge>
          )
        },
      },
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="font-semibold text-foreground">{row.original.employeeName}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{row.original.employeeCode}</div>
          </div>
        ),
      },
      {
        accessorKey: "departmentName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.departmentName}</span>
        ),
      },
      {
        accessorKey: "anomalyType",
        header: "Rule Triggered",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.original.anomalyType}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: "Finding Description",
        cell: ({ row }) => <span className="text-xs">{row.original.description}</span>,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-semibold tabular-nums font-mono">
            ₱{row.original.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircleIcon className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2Icon className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Banner: Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground">Pending Review</div>
          <div className="mt-1 text-2xl font-bold text-amber-500">
            {periods.filter((p) => p.status === "PendingReview").length}
          </div>
          <div className="text-[11px] text-muted-foreground">Awaiting HR / Manager check</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground">Under Review</div>
          <div className="mt-1 text-2xl font-bold text-blue-500">
            {periods.filter((p) => p.status === "UnderReview").length}
          </div>
          <div className="text-[11px] text-muted-foreground">Verification in progress</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground">Approved</div>
          <div className="mt-1 text-2xl font-bold text-primary">
            {periods.filter((p) => p.status === "Approved").length}
          </div>
          <div className="text-[11px] text-muted-foreground">Ready for final lock</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground">Finalized & Locked</div>
          <div className="mt-1 text-2xl font-bold text-emerald-500">
            {periods.filter((p) => p.status === "Finalized").length}
          </div>
          <div className="text-[11px] text-muted-foreground">Locked for banking & payslips</div>
        </Card>
      </div>

      {/* Period Selection & Main Approval Pipeline Card */}
      {selectedPeriod && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  {selectedPeriod.name} ({selectedPeriod.code})
                </CardTitle>
                <Badge
                  variant={
                    selectedPeriod.status === "Finalized"
                      ? "default"
                      : selectedPeriod.status === "Approved"
                      ? "outline"
                      : selectedPeriod.status === "Rejected"
                      ? "destructive"
                      : "secondary"
                  }
                  className="font-mono text-xs"
                >
                  {selectedPeriod.status === "Finalized" && (
                    <LockIcon className="mr-1 size-3 inline" />
                  )}
                  {selectedPeriod.status}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Cutoff: {selectedPeriod.startDate} → {selectedPeriod.endDate} • Pay Date: {selectedPeriod.payDate} • {selectedPeriod.payFrequency}
              </CardDescription>
            </div>

            {/* Quick Period Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Select Period:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => handleSelectPeriod(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} [{p.status}]
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Visual Multi-Step Approval Pipeline */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Approval Lifecycle Progression
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const currentIdx = getStageIndex(selectedPeriod.status)
                  const isCurrent = selectedPeriod.status === stage.key
                  const isPast = currentIdx > idx
                  const isRejected = selectedPeriod.status === "Rejected" && stage.key === "PendingReview"

                  return (
                    <div
                      key={stage.key}
                      className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                        isCurrent
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                          : isRejected
                          ? "border-destructive/60 bg-destructive/10 text-destructive font-semibold"
                          : isPast
                          ? "border-primary/40 bg-muted/60 text-foreground"
                          : "border-border/50 text-muted-foreground opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-center size-6 rounded-full mb-1 text-[11px] font-bold border">
                        {isPast ? (
                          <CheckCircle2Icon className="size-4 text-primary" />
                        ) : isRejected ? (
                          <XCircleIcon className="size-4 text-destructive" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div className="text-xs">{stage.label}</div>
                    </div>
                  )
                })}
              </div>

              {/* Rejection Remarks Banner if Rejected */}
              {selectedPeriod.status === "Rejected" && selectedPeriod.rejectionRemarks && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <ShieldAlertIcon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Rejection Feedback: </span>
                    {selectedPeriod.rejectionRemarks}
                  </div>
                </div>
              )}
            </div>

            {/* Governance Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                {selectedPeriod.submittedByEmail && (
                  <div>
                    <span className="font-medium text-foreground">Submitted: </span>
                    {selectedPeriod.submittedByEmail} ({selectedPeriod.submittedAtUtc?.split("T")[0]})
                  </div>
                )}
                {selectedPeriod.approvedByEmail && (
                  <div>
                    <span className="font-medium text-foreground">Approved: </span>
                    {selectedPeriod.approvedByEmail} ({selectedPeriod.approvedAtUtc?.split("T")[0]})
                  </div>
                )}
                {selectedPeriod.finalizedByEmail && (
                  <div>
                    <span className="font-medium text-foreground">Locked: </span>
                    {selectedPeriod.finalizedByEmail} ({selectedPeriod.finalizedAtUtc?.split("T")[0]})
                  </div>
                )}
              </div>

              {/* Dynamic Action Buttons based on User Role and State */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Submit for Review */}
                {isPayrollOrAdmin &&
                  (selectedPeriod.status === "Computed" || selectedPeriod.status === "Rejected") && (
                    <Button
                      size="sm"
                      onClick={() => setSubmitModalOpen(true)}
                      disabled={actionLoading}
                    >
                      <SendIcon className="mr-1.5 size-3.5" />
                      Submit for Review
                    </Button>
                  )}

                {/* 2. Start Review */}
                {isHrOrAdmin && selectedPeriod.status === "PendingReview" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeAction("start-review")}
                    disabled={actionLoading}
                  >
                    <ClockIcon className="mr-1.5 size-3.5" />
                    Start Verification
                  </Button>
                )}

                {/* 3. Approve */}
                {isHrOrAdmin &&
                  (selectedPeriod.status === "PendingReview" || selectedPeriod.status === "UnderReview") && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setApproveModalOpen(true)}
                      disabled={actionLoading}
                    >
                      <CheckCircle2Icon className="mr-1.5 size-3.5" />
                      Approve Payroll Run
                    </Button>
                  )}

                {/* 4. Reject with Remarks */}
                {isHrOrAdmin &&
                  (selectedPeriod.status === "PendingReview" ||
                    selectedPeriod.status === "UnderReview" ||
                    selectedPeriod.status === "Approved") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={actionLoading}
                    >
                      <XCircleIcon className="mr-1.5 size-3.5" />
                      Reject Run...
                    </Button>
                  )}

                {/* 5. Finalize & Lock Payroll */}
                {isAdmin && selectedPeriod.status === "Approved" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={() => setFinalizeModalOpen(true)}
                    disabled={actionLoading}
                  >
                    <LockIcon className="mr-1.5 size-3.5" />
                    Finalize & Lock Payroll
                  </Button>
                )}

                {selectedPeriod.status === "Finalized" && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                    <ShieldCheckIcon className="size-4" />
                    Payroll Permanently Locked
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Console: Tabs for Variance, Anomalies, Audit Trail, and Executive Summary */}
      {selectedPeriod && (
        <Tabs defaultValue="variance" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-4 sm:w-auto">
            <TabsTrigger value="variance" className="gap-1.5 text-xs">
              <ScaleIcon className="size-3.5" />
              Variance Analysis
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-1.5 text-xs">
              <AlertTriangleIcon className="size-3.5" />
              Audit Flags & Anomalies ({variance?.totalAnomaliesCount ?? 0})
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs">
              <HistoryIcon className="size-3.5" />
              Governance Audit Trail ({auditLogs.length})
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs">
              <FileCheck2Icon className="size-3.5" />
              Executive Financials
            </TabsTrigger>
          </TabsList>

          {/* ========================================================== */}
          {/* TAB 1: PERIOD-OVER-PERIOD VARIANCE ANALYSIS                 */}
          {/* ========================================================== */}
          <TabsContent value="variance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Period-Over-Period Variance Check
                    </CardTitle>
                    <CardDescription>
                      Comparing current cutoff ({selectedPeriod.code}) against preceding cutoff (
                      {variance?.previousPeriodCode ?? "None available"}).
                    </CardDescription>
                  </div>
                  {variance?.hasPreviousPeriod ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      Baseline: {variance.previousPeriodCode}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Initial Baseline (No prior period)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Metric Comparison KPI Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {variance?.comparisons.slice(0, 4).map((comp) => (
                    <div key={comp.metricName} className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">{comp.metricName}</div>
                      <div className="mt-1 text-lg font-bold tabular-nums">
                        {comp.metricName === "Headcount"
                          ? comp.currentValue.toLocaleString()
                          : `₱${comp.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px]">
                        {comp.isIncrease ? (
                          <TrendingUpIcon className="size-3 text-emerald-500" />
                        ) : (
                          <TrendingDownIcon className="size-3 text-destructive" />
                        )}
                        <span
                          className={`font-semibold tabular-nums ${
                            comp.isIncrease ? "text-emerald-500" : "text-destructive"
                          }`}
                        >
                          {comp.isIncrease ? "+" : ""}
                          {comp.percentChange}%
                        </span>
                        <span className="text-muted-foreground">vs prev</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Variance Detail Breakdown Table with DataTable */}
                <DataTable
                  columns={varianceColumns}
                  data={variance?.comparisons ?? []}
                  searchPlaceholder="Filter variance metrics..."
                  hidePagination={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 2: AUDIT FLAGS & ANOMALY SCANNER                        */}
          {/* ========================================================== */}
          <TabsContent value="anomalies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Audit Flags & Outlier Detection
                    </CardTitle>
                    <CardDescription>
                      Automated audit rules scan for zero net pay, abnormal overtime surges, excessive deductions, and salary shifts.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {variance?.criticalAnomaliesCount ?? 0} Critical
                    </Badge>
                    <Badge variant="secondary" className="text-xs text-amber-500">
                      {variance?.warningAnomaliesCount ?? 0} Warnings
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={anomalyColumns}
                  data={variance?.anomalies ?? []}
                  searchPlaceholder="Filter anomalies by employee name or code..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 3: IMMUTABLE GOVERNANCE AUDIT TRAIL                     */}
          {/* ========================================================== */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Immutable Governance Audit Log</CardTitle>
                <CardDescription>
                  Chronological record of state transitions, calculations, sign-offs, and approver remarks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No audit records recorded yet.
                  </div>
                ) : (
                  <div className="relative border-l border-border/80 pl-6 space-y-6">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative group">
                        {/* Bullet Icon */}
                        <div className="absolute -left-[31px] top-1 size-3.5 rounded-full border-2 border-background bg-primary" />
                        <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {log.action}
                              </Badge>
                              <span className="font-semibold text-foreground">
                                {log.fromStatus} → {log.toStatus}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {new Date(log.createdAtUtc).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Actor: <span className="font-medium text-foreground">{log.userEmail || "System"}</span> (
                            {log.userRole || "Service"})
                          </div>
                          {log.remarks && (
                            <div className="rounded bg-muted/60 p-2 text-foreground/90 italic">
                              "{log.remarks}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================== */}
          {/* TAB 4: EXECUTIVE FINANCIAL SUMMARY                          */}
          {/* ========================================================== */}
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Executive Financial Summary & Disbursement</CardTitle>
                <CardDescription>
                  Reconciliation of Gross Earnings, Statutory Remittances, Withholding Tax, and Net Bank Disbursement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="text-xs font-semibold uppercase text-primary tracking-wider border-b pb-2">
                      Total Earnings Breakdown
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-muted-foreground">Basic Pay:</span>
                      <span className="font-semibold tabular-nums font-mono">
                        ₱
                        {(
                          selectedPeriod.totalGrossPay -
                          selectedPeriod.totalOvertimePay
                        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-muted-foreground">Overtime Pay:</span>
                      <span className="font-semibold tabular-nums font-mono">
                        ₱{selectedPeriod.totalOvertimePay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-t font-bold">
                      <span>Total Gross Pay:</span>
                      <span className="text-primary tabular-nums font-mono">
                        ₱{selectedPeriod.totalGrossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="text-xs font-semibold uppercase text-destructive tracking-wider border-b pb-2">
                      Deductions & Statutory Remittance
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-muted-foreground">Gov't Contributions (Employee Share):</span>
                      <span className="font-semibold text-destructive tabular-nums font-mono">
                        -₱{selectedPeriod.totalEmployeeContributions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-muted-foreground">Withholding Tax (BIR):</span>
                      <span className="font-semibold text-destructive tabular-nums font-mono">
                        -₱{selectedPeriod.totalWithholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-muted-foreground">Other Dynamic Deductions:</span>
                      <span className="font-semibold text-destructive tabular-nums font-mono">
                        -₱{selectedPeriod.totalOtherDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-t font-bold">
                      <span>Employer Statutory Contribution (ER Share):</span>
                      <span className="text-muted-foreground tabular-nums font-mono">
                        ₱{selectedPeriod.totalEmployerContributions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Net Bank Disbursement Commitment</div>
                    <div className="text-2xl font-bold text-primary tabular-nums font-mono">
                      ₱{selectedPeriod.totalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Covering {selectedPeriod.employeeCount.toLocaleString()} active employees
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs p-2">
                    Pay Date: {selectedPeriod.payDate}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ============================================================ */}
      {/* DIALOG 1: SUBMIT FOR REVIEW                                  */}
      {/* ============================================================ */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Payroll for Review</DialogTitle>
            <DialogDescription>
              Submit this payroll run ({selectedPeriod?.code}) to HR and Finance reviewers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Submission Notes (Optional)</Label>
            <Input
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              placeholder="e.g. Cutoff completed with all attendance and allowances verified."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={actionLoading}
              onClick={() => executeAction("submit", { remarks: remarksInput })}
            >
              {actionLoading ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 2: APPROVE PAYROLL RUN                                */}
      {/* ============================================================ */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll Run</DialogTitle>
            <DialogDescription>
              Confirm verification of variances, tax computations, and attendance deductions for {selectedPeriod?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Approval Remarks (Optional)</Label>
            <Input
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              placeholder="e.g. Audited and verified against general ledger and timekeeping logs."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={actionLoading}
              onClick={() => executeAction("approve", { remarks: remarksInput })}
            >
              {actionLoading ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 3: REJECT PAYROLL RUN                                 */}
      {/* ============================================================ */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircleIcon className="size-5" />
              Reject Payroll Run
            </DialogTitle>
            <DialogDescription>
              Rejection reverts this payroll run to allow adjustments or recomputation. Please provide detailed feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for Rejection *</Label>
            <Input
              required
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              placeholder="e.g. Missing 3 OT approvals in Engineering; recompute required."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading || !remarksInput.trim()}
              onClick={() => executeAction("reject", { remarks: remarksInput })}
            >
              {actionLoading ? "Rejecting..." : "Reject Payroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 4: FINALIZE & LOCK PAYROLL (ADMIN ONLY)               */}
      {/* ============================================================ */}
      <Dialog open={finalizeModalOpen} onOpenChange={setFinalizeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <LockIcon className="size-5 text-primary" />
              Finalize & Permanently Lock Payroll
            </DialogTitle>
            <DialogDescription>
              Finalization locks all itemized calculations and payslips for {selectedPeriod?.name}. Once finalized, this period cannot be recomputed or modified.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
            <strong>Warning:</strong> This action is irrevocable. All figures will be stamped and ready for Phase 6 Payslip generation and bank file disbursement.
          </div>
          <div className="space-y-2 py-2">
            <Label>Finalization Sign-Off Note (Optional)</Label>
            <Input
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              placeholder="e.g. Authorized for bank wire release."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={actionLoading}
              onClick={() => executeAction("finalize", { remarks: remarksInput })}
            >
              {actionLoading ? "Finalizing..." : "Finalize & Lock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
