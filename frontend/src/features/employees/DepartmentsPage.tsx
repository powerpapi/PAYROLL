import React, { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Department } from "@/features/employees/EmployeesPage"
import { apiFetch } from "@/lib/api"

export function DepartmentsPage({ canEdit }: { canEdit: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Department[]>("/api/departments")
      setDepartments(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/departments", {
        method: "POST",
        body: JSON.stringify({ code, name }),
      })
      setCode("")
      setName("")
      await loadDepartments()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Add Department</CardTitle>
            <CardDescription>
              Create a new department or cost center for employee assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label>Department Code</Label>
                <Input
                  required
                  placeholder="e.g. OPS"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="flex-1 min-w-[220px] space-y-1.5">
                <Label>Department Name</Label>
                <Input
                  required
                  placeholder="e.g. Operations & Logistics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit">
                <PlusIcon className="mr-1.5 size-4" />
                Add Department
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organizational Departments</CardTitle>
          <CardDescription>
            Active departments and enrolled headcount.
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
                  <TableHead>Code</TableHead>
                  <TableHead>Department Name</TableHead>
                  <TableHead className="text-right">Active Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading departments...
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {d.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.employeeCount ?? 0}
                      </TableCell>
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
