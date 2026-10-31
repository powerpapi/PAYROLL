using Microsoft.AspNetCore.Authorization;
using Payroll.Api.Data.Entities;

namespace Payroll.Api.Common.Auth;

public static class RbacPolicies
{
    public const string AdminOnly = "AdminOnly";
    public const string HrOrAdmin = "HrOrAdmin";
    public const string PayrollOrAdmin = "PayrollOrAdmin";

    public static void AddRbacPolicies(this AuthorizationOptions options)
    {
        options.AddPolicy(AdminOnly, policy =>
            policy.RequireRole(UserRoles.Admin));

        options.AddPolicy(HrOrAdmin, policy =>
            policy.RequireRole(UserRoles.Admin, UserRoles.HR));

        options.AddPolicy(PayrollOrAdmin, policy =>
            policy.RequireRole(UserRoles.Admin, UserRoles.PayrollOfficer, UserRoles.HR));
    }
}
