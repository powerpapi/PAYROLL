import React, { useEffect, useState } from "react"
import { PencilIcon, PlusIcon, SearchIcon } from "lucide-react"

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
  payFrequency: string
  basicMonthlySalary: number
  dailyRate: number
  hourlyRate: number
  tinNumber?: string
  sssNumber?: string
  philHealthNumber?: string
  pagIbigNumber?: string
  bankName?: string
  bankAccountNumber?: string
  isActive: boolean
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
  payFrequency: "SemiMonthly",
  basicMonthlySalary: 30000,
  tinNumber: "",
  sssNumber: "",
  philHealthNumber: "",
  pagIbigNumber: "",
  bankName: "",
  bankAccountNumber: "",
  isActive: true,
}

export function EmployeesPage({ canEdit }: { canEdit: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState("")
  const [selectedDept, setSelectedDept] = useState("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (selectedDept && selectedDept !== "ALL") {
        params.set("departmentId", selectedDept)
      }

      const [empData, deptData] = await Promise.all([
        apiFetch<Employee[]>(`/api/employees?${params.toString()}`),
        apiFetch<Department[]>("/api/departments"),
      ])
      setEmployees(empData)
      setDepartments(deptData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedDept])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      departmentId: departments[0]?.id || "",
    })
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id)
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
      payFrequency: emp.payFrequency,
      basicMonthlySalary: emp.basicMonthlySalary,
      tinNumber: emp.tinNumber || "",
      sssNumber: emp.sssNumber || "",
      philHealthNumber: emp.philHealthNumber || "",
      pagIbigNumber: emp.pagIbigNumber || "",
      bankName: emp.bankName || "",
      bankAccountNumber: emp.bankAccountNumber || "",
      isActive: emp.isActive,
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
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
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Employee Directory & Compensation</CardTitle>
            <CardDescription>
              Manage employee profiles, salary structures, bank accounts, and statutory IDs.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={openCreate}>
              <PlusIcon className="mr-1.5 size-4" />
              Add Employee
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <SearchIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, email, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="pl-9"
              />
            </div>

            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="secondary" onClick={loadData}>
              Search
            </Button>
          </div>

          {/* Employee Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department / Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Basic Salary</TableHead>
                  <TableHead className="text-right">Daily / Hourly</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading employees...
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {emp.employeeCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {emp.lastName}, {emp.firstName} {emp.middleName || ""}
                        </div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{emp.jobTitle}</div>
                        <div className="text-xs text-muted-foreground">{emp.departmentName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.isActive ? "default" : "secondary"}>
                          {emp.employmentStatus} {!emp.isActive && "(Inactive)"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ₱{emp.basicMonthlySalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div className="text-xs font-normal text-muted-foreground">
                          {emp.payFrequency}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        <div>₱{emp.dailyRate.toFixed(2)} / day</div>
                        <div>₱{emp.hourlyRate.toFixed(2)} / hr</div>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                            <PencilIcon className="mr-1 size-3.5" />
                            Edit
                          </Button>
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

      {/* shadcn/ui Dialog for Create / Edit Employee */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Employee Profile" : "Add New Employee"}
            </DialogTitle>
            <DialogDescription>
              Daily and hourly rates are automatically computed from the monthly basic salary.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Employee Code *</Label>
                <Input
                  required
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  placeholder="EMP-0003"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hire Date *</Label>
                <Input
                  type="date"
                  required
                  value={form.hireDate}
                  onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Employment Status *</Label>
                <Select
                  value={form.employmentStatus}
                  onValueChange={(v) => setForm({ ...form, employmentStatus: v })}
                >
                  <SelectTrigger>
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
                <Label>First Name *</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Middle Name</Label>
                <Input
                  value={form.middleName}
                  onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => setForm({ ...form, departmentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Job Title *</Label>
                <Input
                  required
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pay Frequency</Label>
                <Select
                  value={form.payFrequency}
                  onValueChange={(v) => setForm({ ...form, payFrequency: v })}
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
              <div className="space-y-1.5">
                <Label>Basic Monthly Salary (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={form.basicMonthlySalary}
                  onChange={(e) =>
                    setForm({ ...form, basicMonthlySalary: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>TIN</Label>
                <Input
                  value={form.tinNumber}
                  onChange={(e) => setForm({ ...form, tinNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>SSS No.</Label>
                <Input
                  value={form.sssNumber}
                  onChange={(e) => setForm({ ...form, sssNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PhilHealth No.</Label>
                <Input
                  value={form.philHealthNumber}
                  onChange={(e) => setForm({ ...form, philHealthNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pag-IBIG No.</Label>
                <Input
                  value={form.pagIbigNumber}
                  onChange={(e) => setForm({ ...form, pagIbigNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Account No.</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                />
              </div>
            </div>

            {editingId && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="empActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: Boolean(checked) })
                  }
                />
                <Label htmlFor="empActive">Employee is Active</Label>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
