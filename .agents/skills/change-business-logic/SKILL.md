---
name: change-business-logic
description: Framework for safely refactoring, updating, or implementing business rules and domain logic within an application codebase. Use when asked to change business rules, update calculations/validations, or modify domain models.
---

# Skill Specification: Change Business Logic

## Overview
This skill provides a structured framework for safely modifying, refactoring, or introducing new business rules and domain logic within an application codebase. It ensures that changes are thoroughly analyzed for downstream impacts, cleanly implemented, and robustly tested.

## Triggers
- "Change the business logic for..."
- "Update how [feature/rule] calculates..."
- "Refactor the validation rules in..."
- "Modify domain logic for..."

## Step-by-Step Workflow

### 1. Impact Analysis & Discovery
- **Identify Domain Boundaries:** Determine which models, services, or controllers are affected.
- **Trace Dependencies:** Map out downstream services, database schemas, UI components, and API contracts that rely on the existing logic.
- **Gather Requirements:** Clearly define what the new business rule should achieve, including edge cases.

### 2. Design & Architecture
- **Decoupling:** Ensure domain logic remains isolated from framework-specific or UI code (keeping code clean and testable).
- **Backward Compatibility:** Decide if versioning or migration strategies are needed for existing data/clients.

### 3. Implementation
- **Write/Update Core Rules:** Apply the new logic in the appropriate domain service or function.
- **Handle Edge Cases:** Ensure boundary values, null states, and error handling are robustly addressed.

### 4. Testing & Verification
- **Unit Tests:** Write or update unit tests targeting the specific business rules.
- **Integration Tests:** Verify that APIs and database interactions work seamlessly with the new logic.
- **Regression Testing:** Run existing test suites to ensure no unintended side effects.

## Best Practices
- Keep business logic pure and free of side effects where possible.
- Document the "why" behind complex rule changes in code comments or project documentation.
- Follow incremental changes rather than massive rewrites when modifying legacy logic.