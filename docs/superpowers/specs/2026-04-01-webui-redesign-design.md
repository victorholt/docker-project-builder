# Web UI Redesign Design Spec

**Date:** 2026-04-01  
**Status:** Approved  
**Scope:** Full visual redesign of `webui/` — layout shell, theme, and all three main views

---

## Summary

Replace the current default shadcn/ui tab layout with a professional dark purple/indigo design featuring a collapsible sidebar, a 3-step project creation wizard, an improved Docker viewer, and a cleaner test runner. All existing API call logic and state management is preserved; only the UI layer changes.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Dark collapsible sidebar | Developer-tool feel; max content space |
| Palette | Dark purple/indigo + violet gradient | Distinctive, memorable identity |
| Wizard flow | 3-step with two-panel fallback | Guided for new users; power-user escape hatch |
| Service selection | Picker list + live summary panel | Clear feedback on what's selected and ports |
| Implementation | Full component rewrite | Existing components are simple enough; patching would cost more than rewriting |

---

## Theme (`globals.css`)

Dark mode is the only mode — set `class="dark"` on `<html>` in `layout.tsx`.

Updated CSS variables:

| Variable | Value | Role |
|---|---|---|
| `--background` | `#0d0b14` | Page background |
| `--card` | `#13101e` | Surface/card background |
| `--border` | `#2e2040` | Borders, dividers |
| `--primary` | `#a855f7` | Purple-500, primary accent |
| `--secondary` | `#6366f1` | Indigo-500, secondary accent |
| `--muted-foreground` | `#6b7280` | Subdued text |
| `--foreground` | `#f1f5f9` | Primary text |

Gradient utility used throughout: `linear-gradient(135deg, #a855f7, #6366f1)`

---

## Section 1: Layout Shell

### Files
- **New:** `webui/components/app-shell.tsx`
- **Replaced:** `webui/app/page.tsx` (becomes a thin wrapper: `<AppShell />`)
- **Modified:** `webui/app/layout.tsx` (adds `dark` class to `<html>`)
- **Modified:** `webui/app/globals.css` (new palette)

### AppShell

Manages active view state (`'create' | 'viewer' | 'test'`) replacing the top-level `<Tabs>`.

**Sidebar:**
- Collapsed state: 52px wide, icons only with hover tooltips
- Expanded state: 200px wide, icon + label
- Toggle: chevron button on the right edge of the sidebar
- Persists expanded/collapsed state in `localStorage` under key `dpb:sidebar:collapsed`

**Sidebar items:**
| Icon | Label | View |
|---|---|---|
| Wand (lucide `Wand2`) | Create Project | `create` |
| Layers (lucide `Layers`) | Docker Viewer | `viewer` |
| Flask (lucide `FlaskConical`) | Test Runner | `test` |

**Active item styling:** `bg-[#2a1a3e] border border-purple-500` with purple text  
**Inactive item:** transparent bg, `text-[#6b7280]`, hover brightens text

**View navigation callback:** AppShell passes a `setView` callback down to child views that need to navigate between sections (e.g., DockerViewer's empty state navigating to Create). Each view receives it as `onNavigate: (view: 'create' | 'viewer' | 'test') => void`.

**Logo area** (top of sidebar):
- Collapsed: 32×32 gradient square
- Expanded: gradient square + "DPBuilder" wordmark + "Docker Projects" subtitle

---

## Section 2: Create Project Wizard

### Files
- **Replaced:** `webui/components/project-wizard.tsx` → `webui/components/create-project.tsx`

### WizardShell

Accepts `layout: 'steps' | 'two-panel'` prop. Defaults to `'steps'`. Switching requires changing one prop — no restructuring needed. This is a **compile-time/design-time decision** — the prop is not changed at runtime by user interaction. The step indicator is only rendered when `layout="steps"`.

### Step Indicator (steps mode only)

Horizontal progress bar with 3 labelled nodes:
1. **Project Info**
2. **Services**
3. **Review**

- Completed steps: filled checkmark circle, purple
- Current step: gradient ring
- Future steps: dimmed circle, gray

### Step 1 — Project Info

Fields:
- **Project Name** — text input, live slug validation (lowercase + hyphens only), required
- **Domain** — text input, optional, helper: "Defaults to `{name}.local`"
- **Proxy Port** — number input, default 8080, valid range 1–65535; shows inline error "Port must be between 1 and 65535" if out of range; "Next →" is disabled when port is invalid
- **Environments** — pill-toggle buttons: `local` (pre-selected, cannot deselect) / `staging` / `prod`

Navigation: "Next →" disabled until project name is valid.

### Step 2 — Services

Layout: two columns within the step content area.

**Loading state:** While `/api/services` is in-flight, show skeleton rows (3 placeholder bars per category group) in the left column. The "Next →" button is disabled.

**Error state:** If the fetch fails, show an error card in the left column: "Failed to load services. Retry?" with a retry button that re-triggers the fetch.

**Left — service list:**
- Grouped by category using a display-name mapping (see table below)
- Each row: icon placeholder + name + short description
- Click anywhere on row to toggle selection
- Selected: `bg-[#2a1a3e] border-purple-500`, icon glows
- Unselected: `bg-[#1d1428] border-[#2e2040]`, dimmed

**Category display-name mapping** (API key → display label):

| API category key | Display label |
|---|---|
| `app` | APP |
| `database` | DATABASE |
| `cache` | CACHE |
| `mail` | MAIL |
| *(any other)* | Capitalize first letter, show as-is |

**Right — "Your Stack" summary panel (~180px fixed):**
- Header: "Your Stack" + count badge
- One row per selected service: name + editable port input
- **"Use default ports" toggle** at bottom (pre-checked):
  - When checked: all port inputs are disabled and show the default port values; user edits are discarded
  - When unchecked: port inputs become editable; values are initialized from defaults if not yet edited
  - Re-checking restores original default port values, discarding any custom edits
- Empty state: "No services selected yet"

Navigation: "← Back" and "Next →" (disabled if no services selected).

### Step 3 — Review & Generate

Read-only summary:
- Project name, domain, proxy port
- Environments (pill badges)
- Selected services + ports (list)

Actions:
- Large full-width gradient button: "Generate & Download"
- Loading state: spinner + "Generating..."
- Success state: green checkmark, zip filename, instructions ("Extract and run `./myapp up`")
- Error state: red message with error detail

"← Back" link to return to step 2.

### Two-Panel Fallback (`layout="two-panel"`)

- Step indicator hidden
- Left half: Step 1 fields (project name, domain, proxy port, environments)
- Right half: Step 2 service picker + summary panel (same components, same behavior)
- Generate button: full-width at the bottom of the right half, below the summary panel
- Generation states (inline, below the button — no step 3 screen):
  - Loading: spinner replaces button text, "Generating..."
  - Success: button replaced by green success message with zip filename and `./myapp up` instruction; "Create another" link resets the form
  - Error: red error message below button; button re-enabled for retry
- Same state shape as steps mode, different render path

---

## Section 3: Docker Viewer

### Files
- **Replaced:** `webui/components/project-viewer.tsx` → `webui/components/docker-viewer.tsx`

### Project Selector

Replace raw `<select>` with shadcn `Select` component, styled to match dark theme. Purple focus ring.

**Loading state:** While the project list is fetching on mount, show a skeleton placeholder where the selector would appear. Action buttons are disabled.

**Empty state:** friendly card — "No projects found. Create your first project →" calls `onNavigate('create')` (provided by AppShell, see Section 1).

**Error state:** If the project list fetch fails, show an inline error with a Retry button.

### Action Bar

Left group (primary actions):
- **Start** — default variant, large
- **Stop** — destructive variant, large

Right group (secondary actions):
- **Restart** — outline
- **Status** — outline  
- **Logs** — outline

Active action: button shows spinner, all others disabled. Current behavior preserved.

### Output Area

Always rendered (not conditionally shown). Two persistent tabs:

**Status tab:**
- Attempt to parse docker ps output into a table: columns = Service, Image, Status, Ports
- Status column: colored dot (green = running, gray = stopped/exited)
- Falls back gracefully to raw `<pre>` block if parsing fails
- Empty placeholder: "Click Status to load"

**Logs tab:**
- Styled terminal block: `bg-[#0d0b14]`, monospace, purple-tinted scrollbar
- Copy button top-right corner
- Auto-scrolls to bottom on content update
- Empty placeholder: "Click View Logs to load"

---

## Section 4: Test Runner

### Files
- **Replaced:** `webui/components/test-project.tsx` → `webui/components/test-runner.tsx`

### Configuration Card

- Project name input (same slug validation as wizard)
- Services grid: icon-grid card style (same visual treatment as wizard Step 2 — selectable cards with purple glow when selected). **Selection only — no port inputs, no summary panel.** The test runner uses randomized ports internally; users don't configure them here.
- "Run Test" — full-width, large, gradient button

### Running State

Replaces button area while test is in progress:
- Animated pulsing progress bar with step labels: *Generating → Building → Starting → Testing*
- Warning text: "This takes 2–3 minutes — don't close the tab"

### Results Section (appears after completion)

- **Summary bar:** large pass/fail count ("3 / 3 passed"), green or red
- **Result rows:** colored left border (green = pass, red = fail), URL, status message
- Auto-expanded if any failures; collapsed with "Show results" toggle if all pass

### Logs Section

- Same terminal block style as Docker Viewer
- **Collapsed by default** with "Show logs ▼" toggle
- Expands inline — no scroll-past required
- Copy button when expanded

---

## File Change Summary

| File | Action |
|---|---|
| `webui/app/globals.css` | Modify — new dark purple palette |
| `webui/app/layout.tsx` | Modify — add `dark` class to `<html>` |
| `webui/app/page.tsx` | Modify — replace tab structure with `<AppShell />` |
| `webui/components/app-shell.tsx` | New |
| `webui/components/create-project.tsx` | New (replaces `project-wizard.tsx`) |
| `webui/components/docker-viewer.tsx` | New (replaces `project-viewer.tsx`) |
| `webui/components/test-runner.tsx` | New (replaces `test-project.tsx`) |
| `webui/components/project-wizard.tsx` | Delete |
| `webui/components/project-viewer.tsx` | Delete |
| `webui/components/test-project.tsx` | Delete |

No API routes change. No new dependencies required (all components use existing shadcn/ui + lucide-react).

---

## Constraints & Non-Goals

- No new npm dependencies
- No changes to any `webui/app/api/` routes
- No changes to the CLI tool or plugin system
- No light mode toggle — dark-only is intentional
- No real-time log streaming (still on-demand, as today)
