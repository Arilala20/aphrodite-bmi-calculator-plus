# BMI Calculator Plus — Group Aphrodite

A responsive BMI calculator source project for HAMK Assignment 16. This recreated implementation uses plain HTML, CSS, and JavaScript and runs directly in a browser without installing dependencies.

## Features
- Metric and imperial inputs with field-specific validation
- BMI calculation with adult category labels and an indicator positioned by the calculated value
- Age-aware results: adult categories are not applied to users under 20
- General wellness guidance and health screening disclaimer
- Recent calculation history saved locally in the browser
- Reset inputs and clear history
- Responsive dashboard layout with mobile result navigation, keyboard focus styles, and accessible labels/status messages
- High-contrast supporting text, explicit imperial field names, and a saved-history count

## Run locally
1. Download or clone this repository.
2. Open `index.html` in a modern browser.

## Automated tests

The test suite uses Node.js's built-in test runner and does not require third-party packages. From this folder, run:

```sh
npm test
```

For Node requirements, direct test commands, browser smoke-test steps, coverage scope, and limitations, see [TESTING.md](./TESTING.md).

## Source code notes

### `script.js`

The script is a self-invoking browser program. It depends on the calculator elements in `index.html`, browser `document`, `localStorage`, `window.matchMedia`, and standard JavaScript globals. It does not expose a module API or require third-party runtime dependencies.

| Function | Inputs | Output | Responsibilities and side effects |
| --- | --- | --- | --- |
| `category(bmi)` | Finite numeric BMI | Category key: `under`, `healthy`, `over`, or `obese` | Applies adult category thresholds. |
| `readHistory()` | Browser local storage | Validated history array | Reads and filters saved entries, including rejecting non-positive/non-finite BMI values, coercible but invalid values, and inherited category keys; reports malformed or unavailable storage in the status element. |
| `renderHistory()` | Current in-memory history | `undefined` | Updates history markup/count and clear-button state. |
| `setError(message, invalidFields)` | Message and optional input IDs | `undefined` | Clears/sets `aria-invalid`, displays the error, and focuses the first invalid input. |
| `saveHistory()` | Current in-memory history | `undefined` | Writes history to local storage and reports write failures without hiding the result. |
| `calculate(event)` | Optional form submit event; current unit and form values | `undefined` | Validates values, converts units, calculates BMI, updates result/guidance/marker, saves history, and moves focus to the result on mobile. |

The remaining arrow functions are small selectors or event callbacks for the unit switch, form input, reset, and clear-history controls.

The tests cover the script's exposed UI behavior rather than importing private functions. Inputs are the age and metric/imperial form fields; visible outputs include the BMI, category, guidance, error/status messages, range marker, and history list. Persistent side effects use the `aphrodite-bmi-history` local-storage key. Mobile calculations also focus and scroll to the result. Test cases include category thresholds in both measurement systems, marker clamping, null-like values, Unicode, extreme numeric strings, corrupted history entries, and simulated storage failures.

### Documentation conventions

Public-facing descriptions of inputs, outputs, and behavior are written in the README. JSDoc comments in `script.js` document the private function signatures and return types in the JavaScript ecosystem. This serves the same documentation purpose as PEP 287-style docstrings in Python, while following JavaScript/JSDoc conventions rather than applying Python-specific PEP 8 formatting rules.

## Project details
- **Group:** Aphrodite
- **Assignment:** HAMK Assignment 16
- **Original design tool:** Lovable AI
- **This repository's implementation:** HTML, CSS, JavaScript

## Live application
Original published Lovable application: https://bmi-bright-wellness-guide.lovable.app/

> This repository contains a recreated implementation of the app's main functionality, not an exported copy of the original Lovable project. BMI is a screening measure, not a medical diagnosis.
