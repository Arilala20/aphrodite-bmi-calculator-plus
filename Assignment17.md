# Assignment 17: Agentic Application Development

## Project
BMI Calculator Plus

## Tool used
OpenAI Codex extension in Visual Studio Code.

## Objective
To use an autonomous AI coding agent to improve an existing web application, refine its user interface, and verify its functionality.

## Initial development
I provided Codex with a prompt asking it to inspect my existing project, improve the interface, preserve BMI calculations, add input validation, support metric and imperial units, and run tests.

## First iteration
Codex modified four files, reporting 1,007 additions and 36 deletions. The interface was redesigned as a modern wellness dashboard. The reported verification included a successful JavaScript syntax check and 14 passed browser checks.

## Problems and debugging
Codex reported a reset-button naming conflict with the form's native reset method. It corrected the issue. An initial syntax-check command also targeted the wrong directory and had to be rerun. One browser test used the wrong measurement-unit mode; the test sequence was corrected.

## Second iteration

I asked Codex to critically review the interface, identify weaknesses, improve responsive design and accessibility, and test the application again.

The second iteration improved the interface and checked BMI category boundaries, metric and imperial calculations, invalid inputs, reset behavior, history persistence, keyboard accessibility, contrast, and responsive layouts.

Codex reported 26 out of 26 browser checks passed, the final JavaScript syntax check passed, and no browser runtime errors were observed. It also corrected issues involving stale CSS during a narrow-screen test and an early contrast-check script.

The final refinement changed four files: `index.html`, `styles.css`, `script.js`, and `README.md`.

## Model used

The Codex panel displayed `gpt-6-luna` in the screenshot. I recorded the model label displayed by the tool.

## Reflection

This project taught me that autonomous coding requires more than generating code once. I used multiple prompts to improve the application, reviewed debugging issues, and asked the agent to verify its changes. The iterative approach helped produce a more polished interface and gave me a better understanding of testing and code quality.

## Reflection
Using an AI coding agent helped me understand how an existing application can be improved through code inspection, iterative prompting, and testing. I learned that the first implementation should not automatically be treated as the final version. Reviewing the agent's changes and checking its test results are important steps in producing a reliable application.


## Evidence

- Final application screenshot: `Screenshot 2026-10-22 034207.png`
- Codex testing screenshot: `Screenshot 2026-10-22 034004.png`

- GitHub repository: https://github.com/Arilala20/aphrodite-bmi-calculator-plus
- Model used: gpt-6-luna (as displayed in the Codex panel)

