import * as React from "react"
import {
  BanknoteIcon,
  Building2Icon,
  CalculatorIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  HandCoinsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { AuthUser } from "@/lib/api"

export type NavKey =
  | "dashboard"
  | "employees"
  | "departments"
  | "users"
  | "contributions"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: AuthUser
  activeNav: NavKey
  onSelectNav: (key: NavKey) => void
  onLogout: () => void
}

export function AppSidebar({
  user,
  activeNav,
  onSelectNav,
  onLogout,
  ...props
}: AppSidebarProps) {
  const canEditHr = user.role === "Admin" || user.role === "HR"

  const mainNav = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      id: "employees",
      title: "Employees",
      icon: UsersIcon,
      badge: "Phase 1",
    },
    {
      id: "departments",
      title: "Departments",
      icon: Building2Icon,
      badge: "Phase 1",
    },
    ...(canEditHr
      ? [
          {
            id: "users",
            title: "Users & RBAC",
            icon: ShieldCheckIcon,
            badge: "Phase 1",
          },
        ]
      : []),
    {
      id: "contributions",
      title: "Gov't Contributions",
      icon: LandmarkIcon,
      badge: "Phase 4",
    },
  ]

  const upcomingPhases = [
    { title: "Attendance, Leave & OT", icon: CalendarClockIcon, phase: "Phase 2" },
    { title: "Payroll Engine", icon: CalculatorIcon, phase: "Phase 3" },
    { title: "Approvals & Lock", icon: CheckCircle2Icon, phase: "Phase 5" },
    { title: "Payslips & Reports", icon: FileSpreadsheetIcon, phase: "Phase 6" },
    { title: "Loans & 13th-Month", icon: HandCoinsIcon, phase: "Phase 7" },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onSelectNav("dashboard")}
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <BanknoteIcon className="h-5 w-5 text-primary" />
              <span className="text-base font-semibold">Payroll System</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={mainNav}
          activeId={activeNav}
          onSelect={(id) => onSelectNav(id as NavKey)}
          onQuickCreateEmployee={canEditHr ? () => onSelectNav("employees") : undefined}
        />

        <SidebarGroup>
          <SidebarGroupLabel>Upcoming Roadmap Phases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {upcomingPhases.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton disabled className="opacity-60">
                    <item.icon className="size-4" />
                    <span className="flex-1 truncate">{item.title}</span>
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {item.phase}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: user.employeeName || user.email.split("@")[0],
            email: user.email,
            role: user.role,
          }}
          onLogout={onLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
