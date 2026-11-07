import React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  DownloadIcon,
  FileCheckIcon,
  LockIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface PaydayRunStepperProps {
  status: string
  periodName: string
  periodCode: string
  onCompute: () => void
  onNavigateToApprovals?: () => void
  onNavigateToReports?: () => void
  isComputing?: boolean
  canManage?: boolean
}

export function PaydayRunStepper({
  status,
  periodName,
  periodCode,
  onCompute,
  onNavigateToApprovals,
  onNavigateToReports,
  isComputing = false,
  canManage = false,
}: PaydayRunStepperProps) {
  // Determine active step index (0 to 4)
  // 0: Pre-Flight
  // 1: Batch Compute
  // 2: Audit & Outliers
  // 3: Approval & Lock
  // 4: Disbursement
  let activeStep = 0
  if (status === "Draft") activeStep = 0
  else if (status === "Computed") activeStep = 2 // Compute is done, now at Audit
  else if (status === "PendingReview" || status === "UnderReview") activeStep = 3
  else if (status === "Approved") activeStep = 3
  else if (status === "Finalized") activeStep = 4

  const steps = [
    {
      index: 0,
      title: "1. Pre-Flight",
      desc: "Attendance & Leaves",
      icon: FileCheckIcon,
    },
    {
      index: 1,
      title: "2. Batch Compute",
      desc: "Statutory & Tax Engine",
      icon: PlayIcon,
    },
    {
      index: 2,
      title: "3. Audit & Outliers",
      desc: "Variance Verification",
      icon: AlertTriangleIcon,
    },
    {
      index: 3,
      title: "4. Sign-Off & Lock",
      desc: "Governance Approval",
      icon: ShieldCheckIcon,
    },
    {
      index: 4,
      title: "5. Disburse",
      desc: "Bank Batch & Slips",
      icon: DownloadIcon,
    },
  ]

  return (
    <div className="w-full rounded-xl border border-border/70 bg-card p-4 shadow-xs space-y-4">
      {/* Top Header: Period Identity & Progression CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payday Run Command Center
            </span>
            <Badge
              variant={
                status === "Finalized"
                  ? "default"
                  : status === "Computed" || status === "Approved"
                  ? "secondary"
                  : "outline"
              }
              className={
                status === "Finalized"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : status === "Computed"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : status === "UnderReview" || status === "PendingReview"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : ""
              }
            >
              {status}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            {periodName} <span className="font-mono text-xs font-normal text-muted-foreground">({periodCode})</span>
          </h2>
        </div>

        {/* Dynamic Action Trigger based on current status */}
        <div className="flex items-center gap-2">
          {canManage && status !== "Finalized" && (
            <Button
              size="sm"
              onClick={onCompute}
              disabled={isComputing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9"
            >
              <PlayIcon className={`size-3.5 mr-1.5 ${isComputing ? "animate-spin" : ""}`} />
              {isComputing
                ? "Calculating..."
                : status === "Draft"
                ? "Execute Batch Compute"
                : "Recompute Batch"}
            </Button>
          )}

          {status === "Computed" && onNavigateToApprovals && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateToApprovals}
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs h-9"
            >
              <ShieldCheckIcon className="size-3.5 mr-1.5" />
              Submit to Approvals Portal
            </Button>
          )}

          {status === "Finalized" && onNavigateToReports && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateToReports}
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs h-9"
            >
              <DownloadIcon className="size-3.5 mr-1.5" />
              Download Bank Disbursement CSVs
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
        {steps.map((step) => {
          const isDone = activeStep > step.index || (activeStep === 4 && step.index === 4)
          const isCurrent = activeStep === step.index && !(activeStep === 4 && step.index === 4)
          const IconComponent = isDone ? CheckCircle2Icon : step.icon

          return (
            <div
              key={step.index}
              className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                isDone
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : isCurrent
                  ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                  : "bg-muted/30 border-transparent text-muted-foreground opacity-65"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                  isDone
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <IconComponent className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold leading-tight">{step.title}</div>
                <div className="truncate text-[10px] opacity-80 leading-tight">{step.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
