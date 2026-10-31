---
name: project-architect
description: Guides project inception by offering tech stack and design pattern choices (e.g., Vertical Slice Architecture, Clean Architecture, Hexagonal, DDD), generating detailed architecture and database plans for approval, and providing complete scaffolding with post-execution instructions. Use when the user wants to start, scaffold, or architect a new project, choose a tech stack or architectural pattern, or design a codebase structure.
---

# Project Architect

Guide project scaffolding from stack selection to execution. Offer curated choices of design patterns and tech stacks, secure user approval on a concrete architecture plan, and provide full scaffolding with post-execution setup steps.

## When to Use

- Starting or brainstorming a new application, service, or system.
- Deciding between architectural patterns (Vertical Slice, Clean Architecture, Hexagonal, Modular Monolith).
- Selecting an appropriate tech stack, database engine, and ORM/query tooling.
- Scaffolding a structured codebase with runnable local setup instructions.

## Workflow

### 1. Stack & Design Pattern Selection (Menu of Options)
When the user describes their project idea or requirements:
- Analyze requirements (scale, team size, performance, domain complexity).
- Present **2 to 3 tailored options** combining a tech stack and design pattern. For each option, clearly detail:
  - **Pattern:** (e.g., Option A: Vertical Slice Architecture with CQRS; Option B: Clean/Hexagonal Architecture; Option C: Modular Monolith).
  - **Stack:** Language/runtime, web framework, database (PostgreSQL, MongoDB, etc.), and persistence layer (ORM/query builder).
  - **Trade-offs:** Speed of development vs. strict separation of concerns, learning curve, and refactoring friction.
- Ask the user to pick one option or customize components (e.g., "Option A, but swap Prisma for Drizzle and add Redis").

### 2. Architecture & Database Plan (Mandatory Approval Gate)
Once the stack and pattern are chosen, present a comprehensive blueprint before writing any code:
- **Folder & Directory Tree:** Exact structure showcasing feature slices or architectural layers, shared utilities, and config files.
- **Database Architecture:**
  - Database engine selection and schema design (entities, tables/collections, relationships, indices).
  - Local database container specification (`docker-compose.yml`).
- **End-to-End Request Flow:** Trace a sample request from route entry through validation, business logic, persistence, and response.
- **Design Patterns Applied:** (e.g., Mediator/Command-Query handlers, Repository/Unit of Work, Factory).

> **Approval Gate:** Ask the user to review the plan. Do not generate files or boilerplate code until the user explicitly approves or provides adjustments.

### 3. Scaffolding & Code Generation
Upon receiving approval:
- Generate base config files (`package.json`, `go.mod`, `csproj`, `.env.example`, `Dockerfile`, `docker-compose.yml`).
- Generate initial schema definitions, migration scripts, and seed files.
- Provide core domain entities, a working sample feature slice or layer implementation, and dependency injection wiring.

### 4. Post-Execution Instructions
Conclude every scaffolded project with clear, runnable post-execution instructions:
1. **Prerequisites:** CLI runtimes, SDK versions, Docker/Compose.
2. **Environment Setup:** Copying `.env.example` to `.env` with explanation of variables.
3. **Database Launch:** Exact command to spin up the local database (e.g., `docker compose up -d`).
4. **Migrations & Seeding:** CLI commands to run migrations and seed data.
5. **Run & Verify:** Commands to run tests, start the development server, and verify health check endpoints.
6. **Next Feature Guide:** Exact instructions and directory path for where to implement the next feature.

## Gotchas

- Do not jump straight to generating code without first confirming the stack/pattern choice and getting approval on the architectural plan.
- In Vertical Slice Architecture, avoid forced layer abstractions (e.g., generic repository patterns across all slices); keep slices autonomous.
- Always include a working `docker-compose.yml` for local database setup so the user does not need to manually install database engines.