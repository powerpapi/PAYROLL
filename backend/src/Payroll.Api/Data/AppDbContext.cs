using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<ContributionType> ContributionTypes => Set<ContributionType>();
    public DbSet<ContributionSchedule> ContributionSchedules => Set<ContributionSchedule>();
    public DbSet<ContributionBracket> ContributionBrackets => Set<ContributionBracket>();

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
