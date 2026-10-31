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
import { PayrollEnginePage } from "@/features/payroll/PayrollEnginePage"
import { TimekeepingPage } from "@/features/timekeeping/TimekeepingPage"
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/api"

const NAV_TITLES: Record<NavKey, string> = {
  dashboard: "Payroll Overview Dashboard",
  employees: "Employee Directory & Compensation",
  departments: "Departments & Cost Centers",
  users: "Users & Role-Based Access Control",
  timekeeping: "Attendance, Leave & Overtime",
  payroll: "Payroll Calculation Engine & Allowances",
  contributions: "Dynamic Government Contributions",
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

  const canEditHr = user?.role === "Admin" || user?.role === "HR"
  const canManagePayroll =
    user?.role === "Admin" ||
    user?.role === "HR" ||
    user?.role === "PayrollOfficer"
  const canApproveTimekeeping =
    user?.role === "Admin" || user?.role === "HR" || user?.role === "Manager"
  const isAdmin = user?.role === "Admin"

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
                {activeNav === "dashboard" && (
                  <DashboardPage onNavigate={setActiveNav} />
                )}
                {activeNav === "employees" && (
                  <EmployeesPage canEdit={canEditHr} />
                )}
                {activeNav === "departments" && (
                  <DepartmentsPage canEdit={canEditHr} />
                )}
                {activeNav === "users" && canEditHr && (
                  <UsersRbacPage isAdmin={isAdmin} />
                )}
                {activeNav === "timekeeping" && (
                  <TimekeepingPage canApprove={canApproveTimekeeping} />
                )}
                {activeNav === "payroll" && (
                  <PayrollEnginePage canManage={canManagePayroll} />
                )}
                {activeNav === "contributions" && <ContributionsPage />}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      )}
    </ThemeProvider>
  )
}
