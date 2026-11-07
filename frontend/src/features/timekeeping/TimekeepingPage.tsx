import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  CalendarCheck2Icon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  TimerIcon,
  XIcon,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Employee } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

interface AttendanceLog {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  workDate: string
  clockIn?: string | null
  clockOut?: string | null
  status: string
  hoursWorked: number
  lateMinutes: number
  undertimeMinutes: number
  remarks?: string | null
}

interface LeaveType {
  id: string
  code: string
  name: string
  defaultDaysPerYear: number
  isPaid: boolean
}

interface LeaveBalance {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  leaveCode: string
  leaveName: string
  year: number
  entitledDays: number
  usedDays: number
  remainingDays: number
}

interface LeaveRequest {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  leaveCode: string
  leaveName: string
  isPaid: boolean
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: string
  reviewRemarks?: string | null
}

interface OvertimeRequest {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  hourlyRate: number
  workDate: string
  hours: number
  overtimeType: string
  multiplier: number
  computedAmount: number
  reason: string
  status: string
}

const OT_MULTIPLIERS: Record<string, { label: string; rate: number }> = {
  RegularOT: { label: "Regular Overtime (1.25x)", rate: 1.25 },
  RestDayOT: { label: "Rest Day Overtime (1.30x)", rate: 1.3 },
  SpecialHolidayOT: { label: "Special Holiday OT (1.30x)", rate: 1.3 },
  RegularHolidayOT: { label: "Regular Holiday OT (2.00x)", rate: 2.0 },
}

export function TimekeepingPage({ canApprove }: { canApprove: boolean }) {
  const today = new Date().toISOString().split("T")[0]

  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [attendance, setAttendance] = useState<AttendanceLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [attModalOpen, setAttModalOpen] = useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [leaveTypeModalOpen, setLeaveTypeModalOpen] = useState(false)
  const [otModalOpen, setOtModalOpen] = useState(false)

  // New Leave Type Form
  const [ltForm, setLtForm] = useState({
    code: "",
    name: "",
    defaultDaysPerYear: 5,
    isPaid: true,
  })

  // Attendance Form
  const [attForm, setAttForm] = useState({
    employeeId: "",
    workDate: today,
    clockIn: "09:00",
    clockOut: "18:00",
    status: "Present",
    remarks: "",
  })

  // Leave Form
  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    startDate: today,
    endDate: today,
    reason: "",
  })

  // Overtime Form
  const [otForm, setOtForm] = useState({
    employeeId: "",
    workDate: today,
    hours: 2,
    overtimeType: "RegularOT",
    reason: "",
  })

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [empData, ltData, attData, lrData, lbData, otData] = await Promise.all([
        apiFetch<Employee[]>("/api/employees"),
        apiFetch<LeaveType[]>("/api/timekeeping/leave-types"),
        apiFetch<AttendanceLog[]>("/api/timekeeping/attendance"),
        apiFetch<LeaveRequest[]>("/api/timekeeping/leaves"),
        apiFetch<LeaveBalance[]>("/api/timekeeping/leave-balances"),
        apiFetch<OvertimeRequest[]>("/api/timekeeping/overtime"),
      ])

      setEmployees(empData)
      setLeaveTypes(ltData)
      setAttendance(attData)
      setLeaveRequests(lrData)
      setLeaveBalances(lbData)
      setOvertimeRequests(otData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/timekeeping/attendance", {
        method: "POST",
        body: JSON.stringify(attForm),
      })
      setAttModalOpen(false)
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/timekeeping/leaves", {
        method: "POST",
        body: JSON.stringify(leaveForm),
      })
      setLeaveModalOpen(false)
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCreateLeaveType = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/timekeeping/leave-types", {
        method: "POST",
        body: JSON.stringify({
          ...ltForm,
          defaultDaysPerYear: Number(ltForm.defaultDaysPerYear),
        }),
      })
      setLeaveTypeModalOpen(false)
      setLtForm({ code: "", name: "", defaultDaysPerYear: 5, isPaid: true })
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleReviewLeave = async (id: string, status: "Approved" | "Rejected") => {
    setError(null)
    try {
      await apiFetch(`/api/timekeeping/leaves/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCreateOvertime = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/timekeeping/overtime", {
        method: "POST",
        body: JSON.stringify({
          ...otForm,
          hours: Number(otForm.hours),
        }),
      })
      setOtModalOpen(false)
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleReviewOvertime = async (id: string, status: "Approved" | "Rejected") => {
    setError(null)
    try {
      await apiFetch(`/api/timekeeping/overtime/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await loadAll()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const selectedOtEmp = employees.find((e) => e.id === otForm.employeeId)
  const otPreviewAmount = selectedOtEmp
    ? selectedOtEmp.hourlyRate *
      Number(otForm.hours || 0) *
      (OT_MULTIPLIERS[otForm.overtimeType]?.rate ?? 1.25)
    : 0

  // -------------------------------------------------------------
  // Column Definitions for TanStack DataTables
  // -------------------------------------------------------------
  const attendanceColumns = useMemo<ColumnDef<AttendanceLog>[]>(
    () => [
      {
        accessorKey: "workDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.getValue("workDate")}</span>
        ),
      },
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
        id: "clockInOut",
        header: "Clock In / Out",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.clockIn || "--:--"} → {row.original.clockOut || "--:--"}
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
              variant={
                status === "Present"
                  ? "default"
                  : status === "Absent"
                  ? "destructive"
                  : "secondary"
              }
              className={
                status === "Present"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : status === "Absent"
                  ? "text-[10px]"
                  : "text-[10px]"
              }
            >
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: "hoursWorked",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Hours Worked" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums font-mono">
            {row.original.hoursWorked.toFixed(2)} hrs
          </div>
        ),
      },
      {
        id: "lateUndertime",
        header: () => <div className="text-right">Late / Undertime</div>,
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="text-right text-xs tabular-nums font-mono">
              <div className={l.lateMinutes > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                Late: {l.lateMinutes}m
              </div>
              <div className={l.undertimeMinutes > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                UT: {l.undertimeMinutes}m
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.remarks || "—"}</span>
        ),
      },
    ],
    []
  )

  const leaveRequestColumns = useMemo<ColumnDef<LeaveRequest>[]>(
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
        accessorKey: "leaveName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px]">
              {row.original.leaveCode}
            </Badge>
            <span className="text-xs">{row.original.leaveName}</span>
          </div>
        ),
      },
      {
        id: "dates",
        header: "Dates",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.startDate} → {row.original.endDate}
          </span>
        ),
      },
      {
        accessorKey: "totalDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Days" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums font-mono">
            {row.original.totalDays}
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-xs text-muted-foreground block">
            {row.original.reason}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status
          return (
            <Badge
              variant={
                status === "Approved"
                  ? "default"
                  : status === "Rejected"
                  ? "destructive"
                  : "secondary"
              }
              className={
                status === "Approved"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : "text-[10px]"
              }
            >
              {status}
            </Badge>
          )
        },
      },
      ...(canApprove
        ? [
            {
              id: "review",
              header: () => <div className="text-right">Review</div>,
              cell: ({ row }: { row: any }) => {
                const lr = row.original as LeaveRequest
                if (lr.status !== "Pending") {
                  return <div className="text-right text-xs text-muted-foreground">Reviewed</div>
                }
                return (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleReviewLeave(lr.id, "Approved")}
                    >
                      <CheckIcon className="mr-1 size-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleReviewLeave(lr.id, "Rejected")}
                    >
                      <XIcon className="mr-1 size-3" />
                      Reject
                    </Button>
                  </div>
                )
              },
            },
          ]
        : []),
    ],
    [canApprove]
  )

  const leaveBalanceColumns = useMemo<ColumnDef<LeaveBalance>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div className="font-medium text-foreground">
            {row.original.employeeName}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              ({row.original.employeeCode})
            </span>
          </div>
        ),
      },
      {
        accessorKey: "leaveName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px]">
              {row.original.leaveCode}
            </Badge>
            <span className="text-xs">{row.original.leaveName}</span>
          </div>
        ),
      },
      {
        accessorKey: "entitledDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Entitled" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs font-mono">{row.original.entitledDays}</div>
        ),
      },
      {
        accessorKey: "usedDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Used" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs font-mono">{row.original.usedDays}</div>
        ),
      },
      {
        accessorKey: "remainingDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Remaining" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold text-primary tabular-nums text-xs font-mono">
            {row.original.remainingDays}
          </div>
        ),
      },
    ],
    []
  )

  const overtimeColumns = useMemo<ColumnDef<OvertimeRequest>[]>(
    () => [
      {
        accessorKey: "workDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.getValue("workDate")}</span>
        ),
      },
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              ₱{row.original.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr
            </div>
          </div>
        ),
      },
      {
        accessorKey: "overtimeType",
        header: "OT Type & Multiplier",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.original.overtimeType} ({row.original.multiplier.toFixed(2)}x)
          </Badge>
        ),
      },
      {
        accessorKey: "hours",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Hours" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums font-mono text-xs">
            {row.original.hours.toFixed(2)} hrs
          </div>
        ),
      },
      {
        accessorKey: "computedAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Computed OT Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono text-xs">
            ₱{row.original.computedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="max-w-[180px] truncate text-xs text-muted-foreground block">
            {row.original.reason}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status
          return (
            <Badge
              variant={
                status === "Approved"
                  ? "default"
                  : status === "Rejected"
                  ? "destructive"
                  : "secondary"
              }
              className={
                status === "Approved"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : "text-[10px]"
              }
            >
              {status}
            </Badge>
          )
        },
      },
      ...(canApprove
        ? [
            {
              id: "review",
              header: () => <div className="text-right">Review</div>,
              cell: ({ row }: { row: any }) => {
                const ot = row.original as OvertimeRequest
                if (ot.status !== "Pending") {
                  return <div className="text-right text-xs text-muted-foreground">Reviewed</div>
                }
                return (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleReviewOvertime(ot.id, "Approved")}
                    >
                      <CheckIcon className="mr-1 size-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleReviewOvertime(ot.id, "Rejected")}
                    >
                      <XIcon className="mr-1 size-3" />
                      Reject
                    </Button>
                  </div>
                )
              },
            },
          ]
        : []),
    ],
    [canApprove]
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="attendance" className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="attendance" className="gap-1.5">
              <ClockIcon className="size-4" />
              Attendance Logs
            </TabsTrigger>
            <TabsTrigger value="leaves" className="gap-1.5">
              <CalendarCheck2Icon className="size-4" />
              Leave & Balances
            </TabsTrigger>
            <TabsTrigger value="overtime" className="gap-1.5">
              <TimerIcon className="size-4" />
              Overtime Requests
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: ATTENDANCE LOGS                                       */}
        {/* ============================================================ */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Daily Attendance & Time Logs</CardTitle>
                <CardDescription>
                  Clock-in/out logs automatically compute regular hours worked, late minutes (after 09:00), and undertime.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setAttForm({
                    ...attForm,
                    employeeId: employees[0]?.id || "",
                  })
                  setAttModalOpen(true)
                }}
              >
                <PlusIcon className="mr-1.5 size-4" />
                Log Attendance
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={attendanceColumns}
                data={attendance}
                searchPlaceholder="Search attendance by employee name or code..."
                isLoading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: LEAVE REQUESTS & BALANCES                             */}
        {/* ============================================================ */}
        <TabsContent value="leaves" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Leave Applications & Approval Workflow</CardTitle>
                <CardDescription>
                  Approving a paid leave automatically deducts from the employee's annual leave balance.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {canApprove && (
                  <Button
                    variant="outline"
                    onClick={() => setLeaveTypeModalOpen(true)}
                  >
                    <PlusIcon className="mr-1.5 size-4" />
                    Add Leave Type
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setLeaveForm({
                      ...leaveForm,
                      employeeId: employees[0]?.id || "",
                      leaveTypeId: leaveTypes[0]?.id || "",
                    })
                    setLeaveModalOpen(true)
                  }}
                >
                  <PlusIcon className="mr-1.5 size-4" />
                  File Leave Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={leaveRequestColumns}
                data={leaveRequests}
                searchPlaceholder="Search leave requests..."
                isLoading={loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Leave Balances ({new Date().getFullYear()})</CardTitle>
              <CardDescription>
                Entitled, used, and remaining paid leave credits per employee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={leaveBalanceColumns}
                data={leaveBalances}
                searchPlaceholder="Search leave balances..."
                isLoading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: OVERTIME REQUESTS                                     */}
        {/* ============================================================ */}
        <TabsContent value="overtime" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Overtime Requests & Multiplier Computation</CardTitle>
                <CardDescription>
                  Automatically computes OT pay from Employee Hourly Rate × Hours × Multiplier (1.25x, 1.30x, 2.00x).
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setOtForm({
                    ...otForm,
                    employeeId: employees[0]?.id || "",
                  })
                  setOtModalOpen(true)
                }}
              >
                <PlusIcon className="mr-1.5 size-4" />
                File Overtime
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={overtimeColumns}
                data={overtimeRequests}
                searchPlaceholder="Search overtime requests..."
                isLoading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOG 1: LOG ATTENDANCE                                     */}
      {/* ============================================================ */}
      <Dialog open={attModalOpen} onOpenChange={setAttModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Employee Attendance</DialogTitle>
            <DialogDescription>
              Standard shift is 09:00 to 18:00 (1 hour break). Late and undertime minutes are computed automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAttendance} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={attForm.employeeId}
                onValueChange={(v) => setAttForm({ ...attForm, employeeId: v })}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Work Date *</Label>
                <Input
                  type="date"
                  required
                  value={attForm.workDate}
                  onChange={(e) => setAttForm({ ...attForm, workDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status *</Label>
                <Select
                  value={attForm.status}
                  onValueChange={(v) => setAttForm({ ...attForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="OnLeave">On Leave</SelectItem>
                    <SelectItem value="Holiday">Holiday</SelectItem>
                    <SelectItem value="RestDay">Rest Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Clock In (24h)</Label>
                <Input
                  type="time"
                  value={attForm.clockIn}
                  onChange={(e) => setAttForm({ ...attForm, clockIn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Clock Out (24h)</Label>
                <Input
                  type="time"
                  value={attForm.clockOut}
                  onChange={(e) => setAttForm({ ...attForm, clockOut: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input
                placeholder="Optional shift note"
                value={attForm.remarks}
                onChange={(e) => setAttForm({ ...attForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAttModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Attendance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 2: FILE LEAVE REQUEST                                 */}
      {/* ============================================================ */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Leave Request</DialogTitle>
            <DialogDescription>
              Submit a leave application for approval. Paid leaves check available annual balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLeave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={leaveForm.employeeId}
                onValueChange={(v) => setLeaveForm({ ...leaveForm, employeeId: v })}
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
              <Label>Leave Type *</Label>
              <Select
                value={leaveForm.leaveTypeId}
                onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveTypeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.code} — {lt.name} ({lt.isPaid ? "Paid" : "Unpaid"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  required
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Input
                required
                placeholder="Reason for leave"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLeaveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Leave Request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 3: FILE OVERTIME REQUEST                              */}
      {/* ============================================================ */}
      <Dialog open={otModalOpen} onOpenChange={setOtModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Overtime Request</DialogTitle>
            <DialogDescription>
              Overtime pay is automatically calculated from the employee's hourly rate and OT multiplier.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOvertime} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={otForm.employeeId}
                onValueChange={(v) => setOtForm({ ...otForm, employeeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employeeCode} — {e.lastName}, {e.firstName} (₱{e.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Work Date *</Label>
                <Input
                  type="date"
                  required
                  value={otForm.workDate}
                  onChange={(e) => setOtForm({ ...otForm, workDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>OT Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  required
                  value={otForm.hours}
                  onChange={(e) => setOtForm({ ...otForm, hours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Overtime Rate Type *</Label>
              <Select
                value={otForm.overtimeType}
                onValueChange={(v) => setOtForm({ ...otForm, overtimeType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OT_MULTIPLIERS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Estimated Overtime Pay:</span>
              <span className="font-bold text-primary text-base tabular-nums">
                ₱{otPreviewAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Reason / Task Completed *</Label>
              <Input
                required
                placeholder="e.g. Production deployment support"
                value={otForm.reason}
                onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOtModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Overtime</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG 4: ADD CUSTOM LEAVE TYPE                              */}
      {/* ============================================================ */}
      <Dialog open={leaveTypeModalOpen} onOpenChange={setLeaveTypeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Leave Type</DialogTitle>
            <DialogDescription>
              Add a new paid or unpaid leave type (e.g. Paternity Leave, Bereavement Leave).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLeaveType} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Leave Code *</Label>
                <Input
                  required
                  placeholder="e.g. PL"
                  value={ltForm.code}
                  onChange={(e) => setLtForm({ ...ltForm, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default Days / Year *</Label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={ltForm.defaultDaysPerYear}
                  onChange={(e) =>
                    setLtForm({ ...ltForm, defaultDaysPerYear: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Leave Name *</Label>
              <Input
                required
                placeholder="e.g. Paternity Leave"
                value={ltForm.name}
                onChange={(e) => setLtForm({ ...ltForm, name: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLeaveTypeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Leave Type</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
