import React, { useEffect, useState } from "react"
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Clock In / Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Hours Worked</TableHead>
                      <TableHead className="text-right">Late / Undertime</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          Loading attendance logs...
                        </TableCell>
                      </TableRow>
                    ) : attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No attendance logs recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {log.workDate}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{log.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.employeeCode}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.clockIn || "--:--"} → {log.clockOut || "--:--"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "Present"
                                  ? "default"
                                  : log.status === "Absent"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {log.hoursWorked.toFixed(2)} hrs
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            <div className={log.lateMinutes > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                              Late: {log.lateMinutes}m
                            </div>
                            <div className={log.undertimeMinutes > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                              UT: {log.undertimeMinutes}m
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.remarks || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {canApprove && <TableHead className="text-right">Review</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No leave requests filed.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaveRequests.map((lr) => (
                        <TableRow key={lr.id}>
                          <TableCell>
                            <div className="font-medium">{lr.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {lr.employeeCode}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="mr-1.5 font-mono">
                              {lr.leaveCode}
                            </Badge>
                            <span className="text-xs">{lr.leaveName}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {lr.startDate} → {lr.endDate}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {lr.totalDays}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {lr.reason}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                lr.status === "Approved"
                                  ? "default"
                                  : lr.status === "Rejected"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {lr.status}
                            </Badge>
                          </TableCell>
                          {canApprove && (
                            <TableCell className="text-right">
                              {lr.status === "Pending" ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => handleReviewLeave(lr.id, "Approved")}
                                  >
                                    <CheckIcon className="mr-1 size-3" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => handleReviewLeave(lr.id, "Rejected")}
                                  >
                                    <XIcon className="mr-1 size-3" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Reviewed</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead className="text-right">Entitled</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveBalances.map((lb) => (
                      <TableRow key={lb.id}>
                        <TableCell className="font-medium">
                          {lb.employeeName}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({lb.employeeCode})
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mr-1.5 font-mono">
                            {lb.leaveCode}
                          </Badge>
                          {lb.leaveName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lb.entitledDays}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lb.usedDays}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary tabular-nums">
                          {lb.remainingDays}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>OT Type & Multiplier</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Computed OT Pay</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {canApprove && <TableHead className="text-right">Review</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimeRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No overtime requests filed.
                        </TableCell>
                      </TableRow>
                    ) : (
                      overtimeRequests.map((ot) => (
                        <TableRow key={ot.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {ot.workDate}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{ot.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              ₱{ot.hourlyRate.toFixed(2)}/hr
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {ot.overtimeType} ({ot.multiplier.toFixed(2)}x)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {ot.hours.toFixed(2)} hrs
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary tabular-nums">
                            ₱{ot.computedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                            {ot.reason}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ot.status === "Approved"
                                  ? "default"
                                  : ot.status === "Rejected"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {ot.status}
                            </Badge>
                          </TableCell>
                          {canApprove && (
                            <TableCell className="text-right">
                              {ot.status === "Pending" ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => handleReviewOvertime(ot.id, "Approved")}
                                  >
                                    <CheckIcon className="mr-1 size-3" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => handleReviewOvertime(ot.id, "Rejected")}
                                  >
                                    <XIcon className="mr-1 size-3" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Reviewed</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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
                      {e.employeeCode} — {e.lastName}, {e.firstName} (₱{e.hourlyRate.toFixed(2)}/hr)
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
