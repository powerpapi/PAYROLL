## name: feature-scaffolder

description: Guides the creation of new modules or features, with or without process flows, ensuring seamless integration into the project's existing architecture and database models. Use when building new features, adding modules, or implementing feature workflows.

# Feature Scaffolder

Plan, structure, and implement new modules or features—with or without explicit process flows—while adhering to the project's established architecture pattern and database layout.

## When to Use

* Adding a new feature, domain module, or service endpoint.
* Implementing features that require step-by-step process flows, state machines, or transactional boundaries.
* Wiring new components into existing application structures (e.g., VSA slices or Clean Architecture layers).

## Workflow

### 1. Feature Scope & Flow Analysis

Before writing code, define the feature parameters:

* **Feature Purpose:** What value does this module/feature deliver?
* **Process Flow / State Machine (Optional):** Step-by-step sequence or lifecycle states (e.g., Pending -> Processing -> Completed/Failed).
* **Data Requirements:** Inputs, validation rules, output payloads, and database changes (new tables, columns, or relations).
* **Dependencies:** External services, shared libraries, or UI components required.

### 2. Implementation Blueprint & Approval Gate

Present a structured plan before creating files:

* **Affected Files & Directory Tree:** Where the new files will live (e.g., specific VSA slice or layer directories).
* **Data & Business Logic Plan:** Database schema updates, repositories/queries, and core handlers.
* **API / Interface Contract:** Request/response schemas or event definitions.

> **Approval Gate:** Ask the user to review the implementation plan. Do not create files or generate code until the user explicitly approves.

### 3. Scaffolding & Wiring

Upon approval:

* Generate feature files, boilerplate handlers, database migration scripts, and configuration bindings.
* Wire the module into the main application routing or dependency injection container.

### 4. Post-Execution & Verification

Conclude with runnable instructions:

1. **Database Update:** Run migrations or update local DB containers.
2. **Build & Test:** Run type-checks, unit tests, or backend/frontend build commands.
3. **Verification:** Steps to test the new endpoint or module (e.g., via curl or frontend view).

## Gotchas

* Do not introduce new architectural patterns for a single feature if the project already follows a strict pattern (like VSA or Clean Architecture).
* Always account for error handling, validation, and database rollbacks within the feature scope.