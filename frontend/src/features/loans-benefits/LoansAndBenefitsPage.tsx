import React, { useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircleIcon,
  BanknoteIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CoinsIcon,
  DownloadIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartPulseIcon,
  LandmarkIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersIcon,
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
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api"

interface EmployeeOption {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  jobTitle?: string
  departmentName?: string
  basicMonthlySalary?: number
}

interface LoanPaymentItem {
  id: string
  paymentDate: string
  amount: number
  paymentMethod: string
  remarks?: string
}

interface LoanItem {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string
  loanType: string
  referenceNumber: string
  principalAmount: number
  totalAmountDue: number
  monthlyAmortization: number
  amortizationPerCutoff: number
  remainingBalance: number
  totalPaid: number
  termMonths: number
  startDate: string
  endDate: string
  status: string
  remarks?: string
  paymentsCount: number
  payments: LoanPaymentItem[]
}

interface BenefitItem {
  id: string
  code: string
  name: string
  category: string
  description?: string
  coverageAmount: number
  isTaxable: boolean
  isActive: boolean
  enrolledCount: number
}

interface EnrollmentItem {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string
  companyBenefitId: string
  benefitCode: string
  benefitName: string
  benefitCategory: string
  coverageAmount: number
  enrollmentDate: string
  status: string
  remarks?: string
}

interface ThirteenthMonthRecord {
  id: string
  employeeCode: string
  employeeName: string
  department: string
  jobTitle: string
  hireDate: string
  basicMonthlySalary: number
  totalBasicEarnedYtd: number
  totalAbsenceDeductions: number
  netBasicSalary: number
  thirteenthMonthPay: number
  taxExemptAmount: number
  taxableAmount: number
  estimatedTax: number
  netPayout: number
}

interface ThirteenthMonthResponse {
  year: number
  totalEmployees: number
  totalGrossThirteenthMonth: number
  totalTaxExempt: number
  totalTaxable: number
  totalNetPayout: number
  taxExemptThreshold: number
  records: ThirteenthMonthRecord[]
}

export function LoansAndBenefitsPage({ userRole }: { userRole: string }) {
  const canManage =
    userRole === "Admin" || userRole === "HR" || userRole === "PayrollOfficer"

  const [activeTab, setActiveTab] = useState<"loans" | "benefits" | "thirteenth">("loans")
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  // Loans State
  const [loans, setLoans] = useState<LoanItem[]>([])
  const [loanStatusFilter, setLoanStatusFilter] = useState("ALL")
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null)
  const [isLoadingLoans, setIsLoadingLoans] = useState(false)

  // New Loan Form State
  const [loanForm, setLoanForm] = useState({
    employeeId: "",
    loanType: "SSS Salary Loan",
    referenceNumber: "",
    principalAmount: "",
    totalAmountDue: "",
    monthlyAmortization: "",
    termMonths: "12",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split("T")[0],
    remarks: "",
  })

  // Loan Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Payroll Deduction",
    remarks: "",
  })

  // Benefits State
  const [benefits, setBenefits] = useState<BenefitItem[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([])
  const [isEnrollOpen, setIsEnrollOpen] = useState(false)
  const [selectedBenefitForEnroll, setSelectedBenefitForEnroll] = useState<BenefitItem | null>(null)
  const [enrollForm, setEnrollForm] = useState({
    employeeId: "",
    companyBenefitId: "",
    enrollmentDate: new Date().toISOString().split("T")[0],
    coverageAmount: "",
    remarks: "",
  })

  // 13th-Month State
  const [thirteenthYear, setThirteenthYear] = useState(new Date().getFullYear())
  const [thirteenthData, setThirteenthData] = useState<ThirteenthMonthResponse | null>(null)
  const [isLoadingThirteenth, setIsLoadingThirteenth] = useState(false)

  // Status message
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setAlertMsg({ type, text })
    setTimeout(() => setAlertMsg(null), 4000)
  }

  // Fetch initial employee dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await apiFetch<EmployeeOption[]>("/api/employees")
        setEmployees(data)
      } catch (err: any) {
        console.error("Failed to load employees", err)
      }
    }
    fetchEmployees()
  }, [])

  // Fetch Loans
  const fetchLoans = async () => {
    setIsLoadingLoans(true)
    try {
      const data = await apiFetch<LoanItem[]>(
        `/api/loans-and-benefits/loans?status=${loanStatusFilter}`
      )
      setLoans(data)
    } catch (err: any) {
      showNotification(err.message || "Failed to load loans.", "error")
    } finally {
      setIsLoadingLoans(false)
    }
  }

  useEffect(() => {
    fetchLoans()
  }, [loanStatusFilter])

  // Fetch Benefits & Enrollments
  const fetchBenefitsAndEnrollments = async () => {
    try {
      const [bData, eData] = await Promise.all([
        apiFetch<BenefitItem[]>("/api/loans-and-benefits/benefits"),
        apiFetch<EnrollmentItem[]>("/api/loans-and-benefits/benefits/enrollments"),
      ])
      setBenefits(bData)
      setEnrollments(eData)
    } catch (err: any) {
      showNotification(err.message || "Failed to load benefits.", "error")
    }
  }

  useEffect(() => {
    fetchBenefitsAndEnrollments()
  }, [])

  // Fetch 13th-Month Accrual
  const fetchThirteenthMonth = async (yr: number = thirteenthYear) => {
    setIsLoadingThirteenth(true)
    try {
      const res = await apiFetch<ThirteenthMonthResponse>(
        `/api/loans-and-benefits/thirteenth-month/accrual?year=${yr}`
      )
      setThirteenthData(res)
    } catch (err: any) {
      showNotification(err.message || "Failed to compute 13th-month pay.", "error")
    } finally {
      setIsLoadingThirteenth(false)
    }
  }

  useEffect(() => {
    if (activeTab === "thirteenth") {
      fetchThirteenthMonth(thirteenthYear)
    }
  }, [activeTab, thirteenthYear])

  // Create Loan Submit
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loanForm.employeeId) {
      showNotification("Please select an employee.", "error")
      return
    }

    const principal = parseFloat(loanForm.principalAmount)
    const totalDue = parseFloat(loanForm.totalAmountDue || loanForm.principalAmount)
    const monthly = parseFloat(loanForm.monthlyAmortization)
    const term = parseInt(loanForm.termMonths, 10)

    if (isNaN(principal) || principal <= 0) {
      showNotification("Principal amount must be greater than zero.", "error")
      return
    }

    try {
      await apiFetch("/api/loans-and-benefits/loans", {
        method: "POST",
        body: JSON.stringify({
          employeeId: loanForm.employeeId,
          loanType: loanForm.loanType,
          referenceNumber: loanForm.referenceNumber,
          principalAmount: principal,
          totalAmountDue: totalDue,
          monthlyAmortization: monthly,
          termMonths: term,
          startDate: loanForm.startDate,
          endDate: loanForm.endDate,
          remarks: loanForm.remarks,
        }),
      })

      showNotification("Employee loan successfully registered!")
      setIsNewLoanOpen(false)
      fetchLoans()
      setLoanForm({
        employeeId: "",
        loanType: "SSS Salary Loan",
        referenceNumber: "",
        principalAmount: "",
        totalAmountDue: "",
        monthlyAmortization: "",
        termMonths: "12",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
          .toISOString()
          .split("T")[0],
        remarks: "",
      })
    } catch (err: any) {
      showNotification(err.message || "Failed to create loan.", "error")
    }
  }

  // Record Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoan) return

    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) {
      showNotification("Payment amount must be greater than zero.", "error")
      return
    }

    try {
      await apiFetch(`/api/loans-and-benefits/loans/${selectedLoan.id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          remarks: paymentForm.remarks,
        }),
      })

      showNotification("Loan payment recorded successfully!")
      setIsPaymentOpen(false)
      setSelectedLoan(null)
      setPaymentForm({
        amount: "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Payroll Deduction",
        remarks: "",
      })
      fetchLoans()
    } catch (err: any) {
      showNotification(err.message || "Failed to record payment.", "error")
    }
  }

  // Delete Loan
  const handleDeleteLoan = async (id: string) => {
    if (!confirm("Are you sure you want to remove this employee loan?")) return
    try {
      await apiFetch(`/api/loans-and-benefits/loans/${id}`, { method: "DELETE" })
      showNotification("Loan deleted.")
      fetchLoans()
    } catch (err: any) {
      showNotification(err.message || "Failed to delete loan.", "error")
    }
  }

  // Enroll Employee in Benefit
  const handleEnrollBenefit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollForm.employeeId || !enrollForm.companyBenefitId) {
      showNotification("Please select both an employee and a benefit program.", "error")
      return
    }

    try {
      await apiFetch("/api/loans-and-benefits/benefits/enrollments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: enrollForm.employeeId,
          companyBenefitId: enrollForm.companyBenefitId,
          enrollmentDate: enrollForm.enrollmentDate,
          coverageAmount: parseFloat(enrollForm.coverageAmount || "0"),
          remarks: enrollForm.remarks,
        }),
      })

      showNotification("Employee enrolled in benefit successfully!")
      setIsEnrollOpen(false)
      setSelectedBenefitForEnroll(null)
      fetchBenefitsAndEnrollments()
    } catch (err: any) {
      showNotification(err.message || "Failed to enroll employee.", "error")
    }
  }

  // Cancel Enrollment
  const handleCancelEnrollment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this benefit enrollment?")) return
    try {
      await apiFetch(`/api/loans-and-benefits/benefits/enrollments/${id}`, {
        method: "DELETE",
      })
      showNotification("Benefit enrollment removed.")
      fetchBenefitsAndEnrollments()
    } catch (err: any) {
      showNotification(err.message || "Failed to remove enrollment.", "error")
    }
  }

  // Export 13th-Month CSV
  const handleExportThirteenthMonth = () => {
    const token = localStorage.getItem("payroll_token")
    fetch(`/api/loans-and-benefits/thirteenth-month/accrual/export-csv?year=${thirteenthYear}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `13thMonth_${thirteenthYear}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
      })
      .catch((err) => showNotification(err.message, "error"))
  }

  // KPI Calculations
  const activeLoans = loans.filter((l) => l.status === "Active")
  const totalPrincipal = loans.reduce((acc, l) => acc + (l.principalAmount || 0), 0)
  const totalBalance = activeLoans.reduce((acc, l) => acc + (l.remainingBalance || 0), 0)
  const totalCollected = loans.reduce((acc, l) => acc + (l.totalPaid || 0), 0)

  // -------------------------------------------------------------
  // Data Table Column Definitions (No Checkboxes)
  // -------------------------------------------------------------
  const loanColumns = useMemo<ColumnDef<LoanItem>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode} &bull; {row.original.departmentName || "General"}
            </div>
          </div>
        ),
      },
      {
        id: "loanTypeRef",
        header: "Loan Type & Ref",
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs text-foreground">{row.original.loanType}</div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Ref: {row.original.referenceNumber}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "principalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Principal" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-foreground tabular-nums font-mono text-xs">
            ₱{row.original.principalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "amortizationPerCutoff",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amort / Cutoff" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-mono text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ₱{row.original.amortizationPerCutoff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              ₱{row.original.monthlyAmortization.toLocaleString("en-US", { minimumFractionDigits: 2 })}/mo
            </span>
          </div>
        ),
      },
      {
        id: "balanceProgress",
        header: "Balance Progress",
        cell: ({ row }) => {
          const loan = row.original
          const paidPercent =
            loan.totalAmountDue > 0
              ? Math.min(100, Math.round(((loan.totalPaid || 0) / loan.totalAmountDue) * 100))
              : 100
          return (
            <div className="space-y-1.5 min-w-[160px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-500 font-mono">
                  ₱{loan.remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">{paidPercent}% Paid</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    paidPercent >= 100 ? "bg-emerald-500" : "bg-primary"
                  }`}
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        id: "schedule",
        header: "Term / Schedule",
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="font-medium text-foreground">{row.original.termMonths} Months</span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              {row.original.startDate} &rarr; {row.original.endDate}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status
          return (
            <Badge
              variant={status === "Active" ? "default" : "secondary"}
              className={
                status === "Active"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                  : "text-[10px]"
              }
            >
              {status}
            </Badge>
          )
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Actions</div>,
              cell: ({ row }: { row: any }) => {
                const loan = row.original as LoanItem
                return (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {loan.status === "Active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedLoan(loan)
                          setPaymentForm({
                            amount: loan.amortizationPerCutoff.toString(),
                            paymentDate: new Date().toISOString().split("T")[0],
                            paymentMethod: "Payroll Deduction",
                            remarks: "",
                          })
                          setIsPaymentOpen(true)
                        }}
                        className="h-7 text-xs px-2 text-primary hover:bg-primary/10 border-primary/30"
                      >
                        <BanknoteIcon className="h-3.5 w-3.5 mr-1" />
                        Pay
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLoan(loan.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              },
            },
          ]
        : []),
    ],
    [canManage]
  )

  const enrollmentColumns = useMemo<ColumnDef<EnrollmentItem>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode} &bull; {row.original.departmentName || "General"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "benefitName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Benefit Program" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-xs">{row.original.benefitName}</div>
            <div className="text-[11px] font-mono text-muted-foreground">{row.original.benefitCode}</div>
          </div>
        ),
      },
      {
        accessorKey: "benefitCategory",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.benefitCategory}</span>
        ),
      },
      {
        accessorKey: "coverageAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Coverage Amount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono text-xs">
            ₱{row.original.coverageAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "enrollmentDate",
        header: "Enrollment Date",
        cell: ({ row }) => <span className="text-xs font-mono">{row.original.enrollmentDate}</span>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge
            variant="default"
            className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
          >
            {row.original.status}
          </Badge>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: () => <div className="text-right">Action</div>,
              cell: ({ row }: { row: any }) => (
                <div className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelEnrollment(row.original.id)}
                    className="h-7 text-xs text-muted-foreground hover:text-red-500"
                  >
                    Remove
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage]
  )

  const thirteenthColumns = useMemo<ColumnDef<ThirteenthMonthRecord>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employeeName} ${row.employeeCode} ${row.department}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode} &bull; {row.original.department}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "basicMonthlySalary",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Monthly Basic" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono tabular-nums">
            ₱{row.original.basicMonthlySalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "totalBasicEarnedYtd",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Earned YTD" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono tabular-nums">
            ₱{row.original.totalBasicEarnedYtd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "totalAbsenceDeductions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Absences / LWOP" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono text-red-500 tabular-nums">
            {row.original.totalAbsenceDeductions > 0
              ? `-₱${row.original.totalAbsenceDeductions.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "₱0.00"}
          </div>
        ),
      },
      {
        accessorKey: "netBasicSalary",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Net Basic" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono font-semibold text-foreground tabular-nums">
            ₱{row.original.netBasicSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "thirteenthMonthPay",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="13th-Month Pay" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            ₱{row.original.thirteenthMonthPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "taxExemptAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tax-Exempt (₱90k)" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono text-emerald-500 tabular-nums">
            ₱{row.original.taxExemptAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "taxableAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Taxable Excess" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono text-amber-500 tabular-nums">
            ₱{row.original.taxableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "netPayout",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Net Payout" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs font-mono font-bold text-primary tabular-nums">
            ₱{row.original.netPayout.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Notifications */}
      {alertMsg && (
        <div
          className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
            alertMsg.type === "success"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {alertMsg.type === "success" ? (
            <CheckCircle2Icon className="size-4 shrink-0" />
          ) : (
            <AlertCircleIcon className="size-4 shrink-0" />
          )}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="w-full space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="loans" className="gap-1.5">
              <LandmarkIcon className="size-4" />
              Employee Loans
            </TabsTrigger>
            <TabsTrigger value="benefits" className="gap-1.5">
              <ShieldCheckIcon className="size-4" />
              Benefits & Perks
            </TabsTrigger>
            <TabsTrigger value="thirteenth" className="gap-1.5">
              <BanknoteIcon className="size-4" />
              13th-Month Accrual
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: EMPLOYEE LOANS & GOVERNMENT AMORTIZATIONS               */}
        {/* ============================================================== */}
        <TabsContent value="loans" className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Active Loans</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {activeLoans.length}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  / {loans.length} total
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">Government & company amortizations</div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Total Principal Granted</div>
              <div className="mt-1 text-2xl font-bold font-mono text-foreground">
                ₱{totalPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">Cumulative loan borrowings</div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Remaining Receivables</div>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-500">
                ₱{totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">Outstanding balance across all loans</div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Total Collected To Date</div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-500">
                ₱{totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">Deducted via payroll or direct payments</div>
            </Card>
          </div>

          {/* Loans Card with TanStack DataTable */}
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Employee Loans & Government Amortizations</CardTitle>
                <CardDescription>
                  Track statutory deductions (SSS, Pag-IBIG) and company emergency loans with automated semi-monthly cutoffs.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLoans}
                  disabled={isLoadingLoans}
                >
                  <RefreshCwIcon className={`mr-1.5 size-4 ${isLoadingLoans ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                {canManage && (
                  <Button size="sm" onClick={() => setIsNewLoanOpen(true)}>
                    <PlusIcon className="mr-1.5 size-4" />
                    New Loan Application
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={loanColumns}
                data={loans}
                searchPlaceholder="Search loans by employee name, code, or reference number..."
                isLoading={isLoadingLoans}
                filterElement={
                  <Select value={loanStatusFilter} onValueChange={setLoanStatusFilter}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="Active" className="text-xs">Active Only</SelectItem>
                      <SelectItem value="PaidOff" className="text-xs">Paid Off</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: COMPANY BENEFITS CATALOG & ENROLLMENTS                  */}
        {/* ============================================================== */}
        <TabsContent value="benefits" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Company Benefits Catalog & Non-Taxable Perks</CardTitle>
                <CardDescription>
                  Statutory Philippine De Minimis perks and fringe benefits (HMO, Gym, Optical, Education Grant, Life Insurance).
                </CardDescription>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedBenefitForEnroll(null)
                    setIsEnrollOpen(true)
                  }}
                >
                  <PlusIcon className="mr-1.5 size-4" />
                  Enroll Employee
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {benefits.map((b) => (
                  <Card key={b.id} className="hover:border-primary/40 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {b.code}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={
                            !b.isTaxable
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]"
                          }
                        >
                          {!b.isTaxable ? "De Minimis / Non-Taxable" : "Taxable Fringe Benefit"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-semibold mt-2">{b.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {b.description || `Category: ${b.category}`}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3">
                      <div className="flex items-baseline justify-between border-t pt-3">
                        <span className="text-xs text-muted-foreground">Coverage / Allowance:</span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          ₱{b.coverageAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <UsersIcon className="size-3.5 text-primary" />
                          Active Enrollees:
                        </span>
                        <span className="font-semibold text-foreground">{b.enrolledCount} Employees</span>
                      </div>

                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBenefitForEnroll(b)
                            setEnrollForm({
                              employeeId: "",
                              companyBenefitId: b.id,
                              enrollmentDate: new Date().toISOString().split("T")[0],
                              coverageAmount: b.coverageAmount.toString(),
                              remarks: "",
                            })
                            setIsEnrollOpen(true)
                          }}
                          className="w-full text-xs h-8 mt-2"
                        >
                          Enroll Employee
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Enrollments Table with TanStack DataTable */}
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheckIcon className="size-4 text-emerald-500" />
                    Active Benefit Enrollments
                  </CardTitle>
                  <Badge variant="secondary" className="tabular-nums">
                    {enrollments.length} Total
                  </Badge>
                </div>
                <CardDescription>
                  Review all employee enrollments and individual policy numbers or coverage allowances.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={enrollmentColumns}
                data={enrollments}
                searchPlaceholder="Filter enrollments by employee or benefit program..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: 13TH-MONTH PAY ACCRUAL & STATUTORY ENGINE               */}
        {/* ============================================================== */}
        <TabsContent value="thirteenth" className="space-y-6">
          {/* Statutory Alert Callout */}
          <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-xs">
            <LandmarkIcon className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-foreground">Philippine Statutory Compliance (P.D. 851 & R.A. 10963 TRAIN Law)</span>
              <p className="text-muted-foreground">
                All rank-and-file employees are entitled to 13th-month pay computed as{" "}
                <span className="font-mono font-semibold text-foreground">
                  (Total Basic Salary Earned YTD - Unpaid Absences / LWOP) / 12
                </span>
                . Under the TRAIN Law, the statutory tax-exempt ceiling is{" "}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₱90,000.00</span>.
                Any excess beyond ₱90,000 is included in taxable compensation income.
              </p>
            </div>
          </div>

          {/* 13th-Month Metric Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Total 13th-Month Budget</div>
              <div className="mt-1 text-2xl font-bold font-mono text-foreground">
                ₱
                {(thirteenthData?.totalGrossThirteenthMonth || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Accrued across {thirteenthData?.totalEmployees || 0} employees
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Tax-Exempt Portions</div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-500">
                ₱
                {(thirteenthData?.totalTaxExempt || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Non-taxable under ₱90k statutory threshold
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Taxable Excess</div>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-500">
                ₱
                {(thirteenthData?.totalTaxable || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Subject to graduated Withholding Tax
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Estimated Net Payout</div>
              <div className="mt-1 text-2xl font-bold font-mono text-primary">
                ₱
                {(thirteenthData?.totalNetPayout || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Net cash required for year-end disbursement
              </div>
            </Card>
          </div>

          {/* 13th-Month Accrual Card */}
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>13th-Month Pay Accrual Register</CardTitle>
                <CardDescription>
                  Year-to-date calculation of basic pay, absence deductions, and statutory TRAIN law tax-exempt ceilings for Calendar Year {thirteenthYear}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={thirteenthYear.toString()}
                    onValueChange={(val) => setThirteenthYear(parseInt(val, 10))}
                  >
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025" className="text-xs">2025</SelectItem>
                      <SelectItem value="2026" className="text-xs">2026 (Current)</SelectItem>
                      <SelectItem value="2027" className="text-xs">2027</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchThirteenthMonth(thirteenthYear)}
                    disabled={isLoadingThirteenth}
                  >
                    <RefreshCwIcon className={`mr-1.5 size-4 ${isLoadingThirteenth ? "animate-spin" : ""}`} />
                    Recalculate
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportThirteenthMonth}
                >
                  <DownloadIcon className="mr-1.5 size-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={thirteenthColumns}
                data={thirteenthData?.records ?? []}
                searchPlaceholder="Filter 13th-month accruals by employee or department..."
                isLoading={isLoadingThirteenth}
                footerContent={
                  thirteenthData && thirteenthData.records.length > 0 ? (
                    <TableRow className="border-t-2 font-bold bg-muted/30">
                      <TableCell colSpan={5} className="text-xs font-bold uppercase tracking-wider">
                        Accrual Grand Totals ({thirteenthData.records.length} Employees)
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        ₱
                        {thirteenthData.records
                          .reduce((acc, r) => acc + r.thirteenthMonthPay, 0)
                          .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-500 font-mono font-bold">
                        ₱
                        {thirteenthData.records
                          .reduce((acc, r) => acc + r.taxExemptAmount, 0)
                          .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs text-amber-500 font-mono font-bold">
                        ₱
                        {thirteenthData.records
                          .reduce((acc, r) => acc + r.taxableAmount, 0)
                          .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs text-primary font-mono font-bold">
                        ₱
                        {thirteenthData.records
                          .reduce((acc, r) => acc + r.netPayout, 0)
                          .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* DIALOG: NEW LOAN APPLICATION                                   */}
      {/* ============================================================== */}
      <Dialog open={isNewLoanOpen} onOpenChange={setIsNewLoanOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CoinsIcon className="size-5 text-primary" />
              New Loan Registration
            </DialogTitle>
            <DialogDescription>
              Register a government (SSS/Pag-IBIG) or company emergency loan with automated semi-monthly payroll amortizations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLoan} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Employee *</Label>
              <Select
                value={loanForm.employeeId}
                onValueChange={(val) => setLoanForm({ ...loanForm, employeeId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Choose Employee --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Loan Type *</Label>
                <Select
                  value={loanForm.loanType}
                  onValueChange={(val) => setLoanForm({ ...loanForm, loanType: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Loan Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSS Salary Loan">SSS Salary Loan</SelectItem>
                    <SelectItem value="SSS Calamity Loan">SSS Calamity Loan</SelectItem>
                    <SelectItem value="Pag-IBIG Multi-Purpose Loan (MPL)">Pag-IBIG Multi-Purpose Loan (MPL)</SelectItem>
                    <SelectItem value="Pag-IBIG Housing Loan">Pag-IBIG Housing Loan</SelectItem>
                    <SelectItem value="Company Emergency Loan">Company Emergency Loan</SelectItem>
                    <SelectItem value="Educational Assistance Loan">Educational Assistance Loan</SelectItem>
                    <SelectItem value="Salary Advance">Salary Advance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reference / SSS/HDMF Ref # *</Label>
                <Input
                  required
                  placeholder="e.g. SSS-LON-2026-001"
                  value={loanForm.referenceNumber}
                  onChange={(e) => setLoanForm({ ...loanForm, referenceNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Principal (₱) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="30000.00"
                  value={loanForm.principalAmount}
                  onChange={(e) => {
                    const p = e.target.value
                    setLoanForm({
                      ...loanForm,
                      principalAmount: p,
                      totalAmountDue: loanForm.totalAmountDue || p,
                    })
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Total Due (₱) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="30000.00"
                  value={loanForm.totalAmountDue}
                  onChange={(e) => setLoanForm({ ...loanForm, totalAmountDue: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Term (Months) *</Label>
                <Input
                  required
                  type="number"
                  min="1"
                  max="60"
                  value={loanForm.termMonths}
                  onChange={(e) => setLoanForm({ ...loanForm, termMonths: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Amortization (₱) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="1250.00"
                  value={loanForm.monthlyAmortization}
                  onChange={(e) => setLoanForm({ ...loanForm, monthlyAmortization: e.target.value })}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                  Per Cutoff (Semi-Monthly): ₱
                  {loanForm.monthlyAmortization
                    ? (parseFloat(loanForm.monthlyAmortization) / 2).toFixed(2)
                    : "0.00"}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  required
                  type="date"
                  value={loanForm.startDate}
                  onChange={(e) => setLoanForm({ ...loanForm, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks / Description</Label>
              <Input
                placeholder="Optional notes or repayment terms"
                value={loanForm.remarks}
                onChange={(e) => setLoanForm({ ...loanForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewLoanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Register Loan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DIALOG: RECORD LOAN PAYMENT                                    */}
      {/* ============================================================== */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BanknoteIcon className="size-5 text-primary" />
              Record Loan Payment
            </DialogTitle>
            <DialogDescription>
              {selectedLoan && (
                <span>
                  Employee: <strong>{selectedLoan.employeeName}</strong> &bull; Loan:{" "}
                  <strong>{selectedLoan.loanType}</strong> (Ref: {selectedLoan.referenceNumber})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance:</span>
                  <span className="font-bold text-amber-500 font-mono">
                    ₱{selectedLoan.remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard Cutoff Amortization:</span>
                  <span className="font-semibold text-foreground font-mono">
                    ₱{selectedLoan.amortizationPerCutoff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Amount (₱) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Payment Date *</Label>
                  <Input
                    required
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Payment Method *</Label>
                  <Select
                    value={paymentForm.paymentMethod}
                    onValueChange={(val) => setPaymentForm({ ...paymentForm, paymentMethod: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Payroll Deduction">Payroll Deduction</SelectItem>
                      <SelectItem value="Cash / OTC">Cash / Direct OTC</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Company Check">Company Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Input
                  placeholder="Official receipt # or transaction ref"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Apply Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DIALOG: ENROLL BENEFIT                                         */}
      {/* ============================================================== */}
      <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulseIcon className="size-5 text-primary" />
              Enroll Employee in Company Benefit
            </DialogTitle>
            <DialogDescription>
              Grant fringe benefit coverage or non-taxable perks to an employee.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnrollBenefit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Employee *</Label>
              <Select
                value={enrollForm.employeeId}
                onValueChange={(val) => setEnrollForm({ ...enrollForm, employeeId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Choose Employee --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Company Benefit Program *</Label>
              <Select
                value={enrollForm.companyBenefitId}
                onValueChange={(val) => {
                  const found = benefits.find((b) => b.id === val)
                  setEnrollForm({
                    ...enrollForm,
                    companyBenefitId: val,
                    coverageAmount: found ? found.coverageAmount.toString() : enrollForm.coverageAmount,
                  })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Choose Benefit --" />
                </SelectTrigger>
                <SelectContent>
                  {benefits.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code}) - ₱{b.coverageAmount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Enrollment Date *</Label>
                <Input
                  required
                  type="date"
                  value={enrollForm.enrollmentDate}
                  onChange={(e) => setEnrollForm({ ...enrollForm, enrollmentDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Coverage Amount (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={enrollForm.coverageAmount}
                  onChange={(e) => setEnrollForm({ ...enrollForm, coverageAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input
                placeholder="Policy number, membership ID, or tier notes"
                value={enrollForm.remarks}
                onChange={(e) => setEnrollForm({ ...enrollForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEnrollOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Confirm Enrollment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
