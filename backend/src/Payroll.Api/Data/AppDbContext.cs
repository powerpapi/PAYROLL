using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // Phase 1
    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();

    // Phase 2
    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<OvertimeRequest> OvertimeRequests => Set<OvertimeRequest>();

    // Phase 3
    public DbSet<EmployeeAllowance> EmployeeAllowances => Set<EmployeeAllowance>();
    public DbSet<PayrollPeriod> PayrollPeriods => Set<PayrollPeriod>();
    public DbSet<PayrollItem> PayrollItems => Set<PayrollItem>();
    public DbSet<PayrollItemLine> PayrollItemLines => Set<PayrollItemLine>();

    // Phase 4
    public DbSet<ContributionType> ContributionTypes => Set<ContributionType>();
    public DbSet<ContributionSchedule> ContributionSchedules => Set<ContributionSchedule>();
    public DbSet<ContributionBracket> ContributionBrackets => Set<ContributionBracket>();
    public DbSet<TaxBracket> TaxBrackets => Set<TaxBracket>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global convention: all decimal properties use NUMERIC(18,4) for exact financial math
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    property.SetColumnType("numeric(18,4)");
                }
            }
        }

        modelBuilder.Entity<User>(b =>
        {
            b.HasIndex(u => u.Email).IsUnique();
            b.Property(u => u.Email).HasMaxLength(256);
            b.Property(u => u.Role).HasMaxLength(64);
            b.HasOne(u => u.Employee)
             .WithOne()
             .HasForeignKey<User>(u => u.EmployeeId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Department>(b =>
        {
            b.HasIndex(d => d.Code).IsUnique();
            b.Property(d => d.Code).HasMaxLength(32);
            b.Property(d => d.Name).HasMaxLength(128);
        });

        modelBuilder.Entity<Employee>(b =>
        {
            b.HasIndex(e => e.EmployeeCode).IsUnique();
            b.HasIndex(e => e.Email).IsUnique();
            b.Property(e => e.EmployeeCode).HasMaxLength(32);
            b.Property(e => e.FirstName).HasMaxLength(100);
            b.Property(e => e.LastName).HasMaxLength(100);
        });

        // Phase 2 Configurations
        modelBuilder.Entity<AttendanceLog>(b =>
        {
            b.HasIndex(a => new { a.EmployeeId, a.WorkDate }).IsUnique();
            b.Property(a => a.Status).HasMaxLength(32);
            b.HasOne(a => a.Employee)
             .WithMany()
             .HasForeignKey(a => a.EmployeeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveType>(b =>
        {
            b.HasIndex(l => l.Code).IsUnique();
            b.Property(l => l.Code).HasMaxLength(32);
            b.Property(l => l.Name).HasMaxLength(128);
        });

        modelBuilder.Entity<LeaveBalance>(b =>
        {
            b.HasIndex(lb => new { lb.EmployeeId, lb.LeaveTypeId, lb.Year }).IsUnique();
            b.HasOne(lb => lb.Employee)
             .WithMany()
             .HasForeignKey(lb => lb.EmployeeId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(lb => lb.LeaveType)
             .WithMany()
             .HasForeignKey(lb => lb.LeaveTypeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveRequest>(b =>
        {
            b.Property(lr => lr.Status).HasMaxLength(32);
            b.HasOne(lr => lr.Employee)
             .WithMany()
             .HasForeignKey(lr => lr.EmployeeId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(lr => lr.LeaveType)
             .WithMany()
             .HasForeignKey(lr => lr.LeaveTypeId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OvertimeRequest>(b =>
        {
            b.Property(ot => ot.OvertimeType).HasMaxLength(32);
            b.Property(ot => ot.Status).HasMaxLength(32);
            b.HasOne(ot => ot.Employee)
             .WithMany()
             .HasForeignKey(ot => ot.EmployeeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Phase 3 Configurations
        modelBuilder.Entity<EmployeeAllowance>(b =>
        {
            b.Property(ea => ea.Name).HasMaxLength(128);
            b.Property(ea => ea.Frequency).HasMaxLength(32);
            b.HasOne(ea => ea.Employee)
             .WithMany()
             .HasForeignKey(ea => ea.EmployeeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PayrollPeriod>(b =>
        {
            b.HasIndex(p => p.Code).IsUnique();
            b.Property(p => p.Code).HasMaxLength(32);
            b.Property(p => p.Name).HasMaxLength(128);
            b.Property(p => p.PayFrequency).HasMaxLength(32);
            b.Property(p => p.Status).HasMaxLength(32);
        });

        modelBuilder.Entity<PayrollItem>(b =>
        {
            b.HasIndex(pi => new { pi.PayrollPeriodId, pi.EmployeeId }).IsUnique();
            b.HasOne(pi => pi.PayrollPeriod)
             .WithMany(p => p.Items)
             .HasForeignKey(pi => pi.PayrollPeriodId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(pi => pi.Employee)
             .WithMany()
             .HasForeignKey(pi => pi.EmployeeId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PayrollItemLine>(b =>
        {
            b.Property(pil => pil.LineType).HasMaxLength(32);
            b.Property(pil => pil.Code).HasMaxLength(32);
            b.Property(pil => pil.Description).HasMaxLength(256);
            b.HasOne(pil => pil.PayrollItem)
             .WithMany(pi => pi.Lines)
             .HasForeignKey(pil => pil.PayrollItemId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Phase 4 Configurations
        modelBuilder.Entity<ContributionType>(b =>
        {
            b.HasIndex(c => c.Code).IsUnique();
            b.Property(c => c.Code).HasMaxLength(32);
            b.Property(c => c.Name).HasMaxLength(128);
        });

        modelBuilder.Entity<ContributionSchedule>(b =>
        {
            b.HasOne(s => s.ContributionType)
             .WithMany(t => t.Schedules)
             .HasForeignKey(s => s.ContributionTypeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ContributionBracket>(b =>
        {
            b.HasOne(br => br.ContributionSchedule)
             .WithMany(s => s.Brackets)
             .HasForeignKey(br => br.ContributionScheduleId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
