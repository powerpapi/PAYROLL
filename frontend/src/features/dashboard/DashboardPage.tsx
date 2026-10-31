import React, { useEffect, useState } from "react"
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon } from "lucide-react"

import { NavKey } from "@/components/app-sidebar"
import { SectionCards } from "@/components/section-cards"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Department, Employee } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

const ROADMAP_PHASES = [
  { phase: "Phase 1", name: "Authentication, RBAC & Employee Management", status: "Active" },
  { phase: "Phase 2", name: "Attendance, Leave & Overtime", status: "Active" },
  { phase: "Phase 3", name: "Payroll Calculation Engine", status: "Active" },
  { phase: "Phase 4", name: "Dynamic Gov't Contributions & Tax", status: "Active" },
  { phase: "Phase 5", name: "Payroll Approval & Finalization", status: "Planned" },
  { phase: "Phase 6", name: "Payslips & Statutory Reports", status: "Planned" },
  { phase: "Phase 7", name: "Loans, Benefits & 13th-Month Pay", status: "Planned" },
]

export function DashboardPage({ onNavigate }: { onNavigate: (nav: NavKey) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [contribCount, setContribCount] = useState(3)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [empData, deptData, contribData] = await Promise.all([
          apiFetch<Employee[]>("/api/employees"),
          apiFetch<Department[]>("/api/departments"),
          apiFetch<any[]>("/api/contributions"),
        ])
        setEmployees(empData)
        setDepartments(deptData)
        setContribCount(contribData.length)
      } catch {
        // Ignore initial load error if backend isn't seeded yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const activeEmployees = employees.filter((e) => e.isActive)
  const totalMonthlyPayroll = activeEmployees.reduce(
    (acc, e) => acc + Number(e.basicMonthlySalary || 0),
    0
  )

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <SectionCards
        metrics={{
          activeEmployees: activeEmployees.length,
          totalMonthlyPayroll,
          departmentCount: departments.length,
          statutoryTypesCount: contribCount,
        }}
      />

      <div className="grid grid-cols-1 gap-6 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Active Employees</CardTitle>
              <CardDescription>
                Compensation overview and assigned department
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate("employees")}>
              View All <ArrowRightIcon className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Basic Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Loading overview...
                    </TableCell>
                  </TableRow>
                ) : activeEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeEmployees.slice(0, 5).map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {emp.employeeCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {emp.lastName}, {emp.firstName}
                        </div>
                        <div className="text-xs text-muted-foreground">{emp.jobTitle}</div>
                      </TableCell>
                      <TableCell>{emp.departmentName}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        ₱{emp.basicMonthlySalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Roadmap Status</CardTitle>
            <CardDescription>7-Phase Vertical Slice Architecture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROADMAP_PHASES.map((item) => (
              <div
                key={item.phase}
                className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">{item.phase}</div>
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                </div>
                {item.status === "Active" ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2Icon className="size-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <ClockIcon className="size-3" />
                    Planned
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
