import React, { useEffect, useState } from "react"
import { CalculatorIcon, PlusIcon } from "lucide-react"

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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch } from "@/lib/api"

interface ContributionLine {
  code: string
  name: string
  employeeShare: number
  employerShare: number
  employerEcShare: number
}

interface PreviewResponse {
  monthlySalary: number
  asOfDate: string
  totalEmployeeShare: number
  totalEmployerShare: number
  contributions: ContributionLine[]
}

export function ContributionsPage() {
  const [salary, setSalary] = useState(35000)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [eeRate, setEeRate] = useState(1.0)
  const [erRate, setErRate] = useState(1.0)
  const [ceiling, setCeiling] = useState(50000)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = async (targetSalary = salary) => {
    setError(null)
    try {
      const data = await apiFetch<PreviewResponse>(
        `/api/contributions/preview?monthlySalary=${targetSalary}`
      )
      setPreview(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadPreview(salary)
  }, [])

  const handleAddCustomContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch("/api/contributions", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          description: "Dynamically added statutory contribution",
          isTaxDeductible: true,
          effectiveFrom: "2025-01-01",
          calculationMode: 2, // Percentage mode
          employeeRatePercent: Number(eeRate),
          employerRatePercent: Number(erRate),
          fixedEmployeeAmount: 0,
          fixedEmployerAmount: 0,
          salaryFloor: 0,
          salaryCeiling: Number(ceiling) || null,
        }),
      })
      setCode("")
      setName("")
      await loadPreview(salary)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Dynamic Government Contributions Simulator</CardTitle>
          <CardDescription>
            Pre-seeded with SSS, PhilHealth, and Pag-IBIG. Test any monthly salary to preview Employee and Employer shares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

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
            <Button onClick={() => loadPreview(salary)}>
              <CalculatorIcon className="mr-1.5 size-4" />
              Calculate Contributions
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Contribution Name</TableHead>
                    <TableHead className="text-right">Employee Share</TableHead>
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
                      <TableCell className="text-right tabular-nums">
                        ₱{c.employeeShare.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₱{c.employerShare.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₱{c.employerEcShare.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      Total Statutory Contributions
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      ₱{preview.totalEmployeeShare.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-bold tabular-nums">
                      ₱{preview.totalEmployerShare.toFixed(2)} (Total ER + EC)
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Dynamic Government Contribution</CardTitle>
          <CardDescription>
            Register new mandatory contributions or updated effective schedules at runtime without code changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleAddCustomContribution}
            className="grid grid-cols-1 gap-4 sm:grid-cols-6 items-end"
          >
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
              <Label>Name *</Label>
              <Input
                required
                placeholder="Local Provident Fund"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>EE Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={eeRate}
                onChange={(e) => setEeRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Salary Ceiling (₱)</Label>
              <Input
                type="number"
                value={ceiling}
                onChange={(e) => setCeiling(Number(e.target.value))}
              />
            </div>
            <Button type="submit">
              <PlusIcon className="mr-1.5 size-4" />
              Add Type
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
