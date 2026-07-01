<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Strict Type Checking

All backend enum data types (e.g. `PlayerType`, `UnitType`) must be strictly checked. Do not use string fallbacks or implicit type coercions in the backend logic. Enforce strict type validation for all enums and raise TypeErrors/ValueErrors directly if types or values are invalid.

# Strict UI Flatness & No Dividers Rule

- **No Dividers**: Never add any divider lines (e.g., `border-b`, `border-t`, `h-[1px]` separator lines) in any UI components or panels. Spacing should be handled purely using spacing primitives (like `space-y-*` or `gap-*`). Keep the interface clean, continuous, and flat.

# Code Cleanliness & Non-Redundant Design Rules

- **Zero Dead Code**: Always keep files tidy by immediately removing unused imports, variables, and deprecated/old/unused functions. Avoid code rot.
- **Strict Data Schemes**: Do not write overly defensive or redundant fallback properties lookup/mapping code (e.g., matching both `PlayerType.DEVELOPER` and its string/number aliases in multiple conditional branches). Fully assume and strictly enforce the standardized data schema types.
- **Shared Logic & Styling Consolidation**: If any logic, calculation formula (e.g., polygon areas/gradients), or styling layout pattern is duplicated, always centralize them into shared utility files (like `function.ts` or `globals.css`) rather than copying and pasting code segments.

