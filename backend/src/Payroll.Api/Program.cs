using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Payroll.Api.Common.Auth;
using Payroll.Api.Data;
using Payroll.Api.Data.Seed;
using Payroll.Api.Features.Auth;
using Payroll.Api.Features.Employees;
using Payroll.Api.Features.PayrollEngine;
using Payroll.Api.Features.StatutoryAndTax;
using Payroll.Api.Features.Timekeeping;

var builder = WebApplication.CreateBuilder(args);

// 1. Database (PostgreSQL + EF Core)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Authentication & RBAC Policies
var jwtSecret = builder.Configuration["Jwt:SecretKey"]
    ?? "super-secret-payroll-jwt-signing-key-at-least-32-bytes!";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "PayrollSystem",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "PayrollSystemUsers",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization(options => options.AddRbacPolicies());
builder.Services.AddSingleton<JwtTokenGenerator>();

// 3. FluentValidation (scans all Vertical Slice validators in this assembly)
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// 4. Native .NET 10 OpenAPI & CORS
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Payroll.Api v1");
    });
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Health Check Endpoint
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }))
   .WithTags("System");

// Map Phase 1 Vertical Slice Endpoints
app.MapAuthEndpoints();
app.MapUserManagementEndpoints();
app.MapDepartmentEndpoints();
app.MapEmployeeEndpoints();

// Map Phase 2 Vertical Slice Endpoints
app.MapAttendanceEndpoints();
app.MapLeaveEndpoints();
app.MapOvertimeEndpoints();

// Map Phase 3 Vertical Slice Endpoints
app.MapAllowanceEndpoints();
app.MapPayrollEngineEndpoints();

// Map Phase 4 Vertical Slice Endpoints
app.MapContributionEndpoints();

// Auto-EnsureCreated & Seed on Startup in Development if DB is reachable
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await db.Database.EnsureCreatedAsync();
        await DatabaseSeeder.SeedAsync(db);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "PostgreSQL database not yet reachable. Configure connection string in appsettings.json and restart.");
    }
}

app.Run();
