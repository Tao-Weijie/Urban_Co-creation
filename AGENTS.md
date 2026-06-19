<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Strict Type Checking

All backend enum data types (e.g. `PlayerType`, `UnitType`) must be strictly checked. Do not use string fallbacks or implicit type coercions in the backend logic. Enforce strict type validation for all enums and raise TypeErrors/ValueErrors directly if types or values are invalid.
