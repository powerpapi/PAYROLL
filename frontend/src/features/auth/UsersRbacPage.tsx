import React, { useEffect, useState } from "react"
import { UserPlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Employee } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

interface SystemUser {
  id: string
  email: string
  role: string
  isActive: boolean
  employeeId?: string | null
  employeeName?: string | null
  employeeCode?: string | null
}

const ROLES = ["Admin", "HR", "PayrollOfficer", "Manager", "Employee"]

export function UsersRbacPage({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("Employee")
  const [employeeId, setEmployeeId] = useState("NONE")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [uData, eData] = await Promise.all([
        apiFetch<SystemUser[]>("/api/users"),
        apiFetch<Employee[]>("/api/employees"),
      ])
      setUsers(uData)
      setEmployees(eData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          employeeId: employeeId && employeeId !== "NONE" ? employeeId : null,
        }),
      })
      setEmail("")
      setPassword("")
      setRole("Employee")
      setEmployeeId("NONE")
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (
    u: SystemUser,
    newRole: string,
    newActive: boolean
  ) => {
    setError(null)
    try {
      await apiFetch(`/api/users/${u.id}/role-status`, {
        method: "PATCH",
        body: JSON.stringify({
          role: newRole,
          isActive: newActive,
          employeeId: u.employeeId || null,
        }),
      })
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Create System User</CardTitle>
            <CardDescription>
              Provision a user account, assign an RBAC role, and optionally link to an employee record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateUser}
              className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-end"
            >
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@payroll.local"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Initial Password *</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                />
              </div>
              <div className="space-y-1.5">
                <Label>RBAC Role *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link to Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">-- None --</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.employeeCode} - {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">
                <UserPlusIcon className="mr-1.5 size-4" />
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User Accounts & Role-Based Access Control</CardTitle>
          <CardDescription>
            Manage system roles (Admin, HR, PayrollOfficer, Manager, Employee) and account status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Linked Employee</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select
                            value={u.role}
                            onValueChange={(val) =>
                              handleToggleActive(u, val, u.isActive)
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{u.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.employeeName
                          ? `${u.employeeName} (${u.employeeCode})`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "default" : "destructive"}>
                          {u.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleActive(u, u.role, !u.isActive)
                            }
                          >
                            {u.isActive ? "Disable" : "Enable"}
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
    </div>
  )
}
