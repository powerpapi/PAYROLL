import React, { useState } from "react"

import { AppSidebar, NavKey } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LoginPage } from "@/features/auth/LoginPage"
import { UsersRbacPage } from "@/features/auth/UsersRbacPage"
import { ContributionsPage } from "@/features/contributions/ContributionsPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { DepartmentsPage } from "@/features/employees/DepartmentsPage"
import { EmployeesPage } from "@/features/employees/EmployeesPage"
import { LoansAndBenefitsPage } from "@/features/loans-benefits/LoansAndBenefitsPage"
import { PayrollApprovalsPage } from "@/features/approvals/PayrollApprovalsPage"
import { PayrollEnginePage } from "@/features/payroll/PayrollEnginePage"
import { ReportsAndPayslipsPage } from "@/features/reports/ReportsAndPayslipsPage"
import { TimekeepingPage } from "@/features/timekeeping/TimekeepingPage"
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/api"
import { ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const DEFAULT_ROLE_FEATURES: Record<string, string[]> = {
  Admin: ["dashboard", "employees", "departments", "users", "timekeeping", "payroll", "contributions", "approvals", "reports", "loans-benefits"],
  HR: ["dashboard", "employees", "departments", "users", "timekeeping", "reports", "loans-benefits"],
  PayrollOfficer: ["dashboard", "employees", "payroll", "contributions", "approvals", "reports", "loans-benefits"],
  Manager: ["dashboard", "employees", "timekeeping", "approvals", "reports"],
  Employee: ["dashboard", "reports"],
}

const NAV_TITLES: Record<NavKey, string> = {
  dashboard: "Payroll Overview Dashboard",
  employees: "Employee Directory & Compensation",
  departments: "Departments & Cost Centers",
  users: "Users & Role-Based Access Control",
  timekeeping: "Attendance, Leave & Overtime",
  payroll: "Payroll Calculation Engine & Allowances",
  contributions: "Dynamic Government Contributions",
  approvals: "Payroll Approval & Finalization Workflow",
  reports: "Official Payslips & Financial Reports",
  "loans-benefits": "Loans, Benefits & 13th-Month Pay",
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard")

  const handleLogin = (loggedInUser: AuthUser) => {
    setStoredUser(loggedInUser)
    setUser(loggedInUser)
  }

  const handleLogout = () => {
    setStoredUser(null)
    setUser(null)
  }

  const allowedFeatures =
    user?.features && user.features.length > 0
      ? user.features
      : user
      ? DEFAULT_ROLE_FEATURES[user.role] || ["dashboard"]
      : []

  const hasAccess = (feature: NavKey) =>
    user?.role === "Admin" || allowedFeatures.includes(feature)

  const canEditHr =
    user?.role === "Admin" || (hasAccess("employees") && (user?.role === "HR" || user?.role === "Admin"))
  const canManagePayroll =
    user?.role === "Admin" ||
    (hasAccess("payroll") && (user?.role === "HR" || user?.role === "PayrollOfficer"))
  const canApproveTimekeeping =
    user?.role === "Admin" ||
    (hasAccess("timekeeping") && (user?.role === "HR" || user?.role === "Manager"))
  const isAdmin = user?.role === "Admin"

  const handlePermissionsUpdated = (updatedFeatures: string[]) => {
    if (user) {
      const updatedUser = { ...user, features: updatedFeatures }
      setStoredUser(updatedUser)
      setUser(updatedUser)
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="payroll-ui-theme">
      {!user ? (
        <LoginPage onLoginSuccess={handleLogin} />
      ) : (
        <SidebarProvider>
          <AppSidebar
            variant="inset"
            user={user}
            activeNav={activeNav}
            onSelectNav={setActiveNav}
            onLogout={handleLogout}
          />
          <SidebarInset>
            <SiteHeader title={NAV_TITLES[activeNav]} role={user.role} />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                {!hasAccess(activeNav) ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="rounded-full bg-destructive/10 p-3 text-destructive mb-3">
                      <ShieldAlertIcon className="size-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      Your current role ({user.role}) does not have permission to access the "{NAV_TITLES[activeNav]}" feature.
                    </p>
                    <Button className="mt-4" onClick={() => setActiveNav("dashboard")}>
                      Return to Dashboard
                    </Button>
                  </div>
                ) : (
                  <>
                    {activeNav === "dashboard" && (
                      <DashboardPage onNavigate={setActiveNav} />
                    )}
                    {activeNav === "employees" && (
                      <EmployeesPage canEdit={canEditHr} />
                    )}
                    {activeNav === "departments" && (
                      <DepartmentsPage canEdit={canEditHr} />
                    )}
                    {activeNav === "users" && (
                      <UsersRbacPage
                        isAdmin={isAdmin}
                        onPermissionsUpdated={handlePermissionsUpdated}
                      />
                    )}
                    {activeNav === "timekeeping" && (
                      <TimekeepingPage canApprove={canApproveTimekeeping} />
                    )}
                    {activeNav === "payroll" && (
                      <PayrollEnginePage canManage={canManagePayroll} />
                    )}
                    {activeNav === "contributions" && <ContributionsPage />}
                    {activeNav === "approvals" && (
                      <PayrollApprovalsPage userRole={user.role} />
                    )}
                    {activeNav === "reports" && (
                      <ReportsAndPayslipsPage user={user} />
                    )}
                    {activeNav === "loans-benefits" && (
                      <LoansAndBenefitsPage userRole={user.role} />
                    )}
                  </>
                )}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      )}
    </ThemeProvider>
  )
}
