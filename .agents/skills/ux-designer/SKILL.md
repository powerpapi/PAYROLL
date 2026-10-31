---
name: ux-designer
description: Guides user experience design, user flows, information architecture, wireframing structure, usability heuristics, and accessibility (WCAG) audits. Use when planning features, structuring user journeys, or reviewing usability and accessibility before UI implementation.
---

# UX Designer

Plan user experiences, design information architecture, map user journeys, evaluate usability heuristics, and ensure accessibility (WCAG compliance) before handing off to code implementation or the `ui-changer` skill.

## When to Use

- Designing new features, onboarding processes, or complex transactional flows.
- Planning user journeys, interaction states (loading, empty, error, success), and information hierarchy.
- Auditing existing interfaces or plans against UX heuristics and accessibility (a11y) standards.

## Workflow

### 1. User Goal & Context Discovery
Before designing flows or layouts, identify:
- **Target Audience:** Who is using the feature and what is their technical proficiency or context?
- **User Intent:** What specific problem or core task is the user trying to accomplish?
- **Business Objectives:** What success metric or conversion goal is tied to this experience?

### 2. User Journey & Information Architecture Plan (Mandatory Approval Gate)
Present a structured UX plan before any code or final UI layout is built:
- **Step-by-Step User Flow:** Actionable path from entry point to goal completion.
- **Information Hierarchy:** Key content elements, prioritization, and grouping.
- **Interaction States:** Explicitly define:
  - *Loading state:* Skeletons or spinners.
  - *Empty state:* Clear call to action when no data exists.
  - *Error state:* Actionable recovery messaging.
  - *Success state:* Confirmation feedback.
- **Accessibility Considerations:** Contrast requirements, keyboard navigation sequence, and ARIA landmarks.

> **Approval Gate:** Ask the user to review the journey and structure. Do not proceed to UI code generation or refactoring until the user explicitly approves the UX plan.

### 3. Handoff to Implementation
Upon approval:
- Provide structured layout guidance or component breakdown for the `ui-changer` skill.
- Define exact layout regions, form fields, and responsive behavior (mobile vs. desktop).

## Gotchas
- Never jump straight into visual styling or component coding without mapping the user journey and mandatory interaction states (empty/error/loading).
- Always consider keyboard accessibility and screen reader flow alongside visual design.