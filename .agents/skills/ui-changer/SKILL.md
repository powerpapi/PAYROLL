---
name: ui-changer
description: Guides UI modifications, component refactoring, and frontend styling depending on the project's specific stack (e.g., shadcn/ui with Tailwind CSS, Material UI, etc.). Use when adding new UI elements, redesigning components, or fixing layout/styling issues.
---

# UI Changer

Modify, refactor, and implement user interfaces in a way that respects and integrates seamlessly with the project's existing frontend stack, design systems, and component libraries (such as `shadcn/ui`, Tailwind CSS, Radix UI, etc.).

## When to Use

- Adding new UI components, pages, or features.
- Redesigning or refactoring existing UI layouts.
- Updating styling, spacing, typography, or responsiveness using the project's established styling rules.
- Integrating new components from libraries like `shadcn/ui`, Radix primitives, or Material UI.

## Workflow

### 1. Frontend Stack & Library Detection
Before making any code changes, identify or confirm the project's frontend ecosystem:
- **Framework/Library:** (e.g., React, Next.js, Vue, Svelte).
- **Styling Engine:** (e.g., Tailwind CSS, CSS Modules, Styled Components, PostCSS).
- **Component Library / Design System:** (e.g., `shadcn/ui`, Radix UI, Lucide icons, Material UI, Mantine).
- **Existing Conventions:** Directory structure for components (e.g., `src/components`, `components/ui`), naming conventions, and state management patterns.

### 2. UI/UX Modification Plan (Mandatory Approval Gate)
Present a brief plan before editing or writing component code:
- **Objective:** What visual or structural change is being made.
- **Affected Components & Files:** Which files will be created or modified.
- **Component Library Usage:** How `shadcn/ui` or existing primitives will be utilized (e.g., combining Dialog, DropdownMenu, or custom variants).
- **Responsive & State Considerations:** Mobile/desktop layouts, loading states, empty states, and error handling.

> **Approval Gate:** Ask the user to review the plan. Do not generate or modify UI code until the user explicitly approves the plan.

### 3. Implementation & Code Generation
Upon approval:
- Generate or update components adhering strictly to the project's TypeScript types, styling classes, and accessibility (a11y) standards.
- Ensure proper use of icon sets (e.g., Lucide React) and design tokens.
- Avoid introducing conflicting CSS frameworks or redundant styling paradigms.

### 4. Post-Execution & Verification Steps
Conclude every UI change with clear verification guidance:
1. **Build & Lint Check:** Run local build or type checks to ensure no broken imports or type errors.
2. **Visual & Responsive Testing:** Verify layout across mobile, tablet, and desktop viewports.
3. **State & Interaction Testing:** Verify interactivity (e.g., open/close states, keyboard accessibility, hover/focus effects).

## Gotchas

- Never mix incompatible styling systems (e.g., injecting vanilla CSS into a strict Tailwind + `shadcn/ui` project unless isolated).
- Always check if an existing `shadcn/ui` component or custom primitive already exists in the codebase before writing custom elements from scratch.