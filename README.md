# Browser Agent MVP (TypeScript + Playwright)

Проект на **Iteration 6**: поверх ядра agent/replay добавлен прикладной UX-слой — CLI, библиотека reusable сценариев и approval mode.

## Архитектура (Iteration 6)

Слои Iteration 5 сохранены (planner/validator/replay/recorder), и добавлены:

- `src/cli/*` — CLI команды `record`, `replay`, `list-scenarios`, `show-scenario`, `run-library-scenario`.
- `src/library/*` — реестр и typed builders reusable сценариев.
- `src/approval/*` — policy + prompter abstractions (`console` и `fake`).
- `src/config/runtime-config.ts` — typed runtime config + env overrides.

Ключевой safety flow:
1. action proposed,
2. validator baseline,
3. approval policy check,
4. user approval (if required),
5. execution,
6. post-step verification.

> Validator остаётся authoritative: если validator отклоняет action — approval prompt не показывается.

## CLI

```bash
npm run cli -- record --name "Search docs" --url http://127.0.0.1:3000/replay-search-page.html
npm run cli -- replay --file scenarios/search.json --mode strict --approval never
npm run cli -- replay --file scenarios/search.json --mode adaptive --approval risky-only
npm run cli -- list-scenarios
npm run cli -- show-scenario --file scenarios/search.json
npm run cli -- run-library-scenario download-file --mode adaptive --param startUrl=http://127.0.0.1:3000/replay-download-page.html --param targetKeyword=Download
```

### Working demo

This demo runs the `extract-main-text` library scenario against the public IANA example page and saves extracted page text to `main.txt`.

```bash
npm run demo:extract-iana
```

After the run, inspect artifacts in `.artifacts/iana-text/`, especially:
- `.artifacts/iana-text/cli-run-summary.json`
- `.artifacts/iana-text/execution-timeline.json`

### CLI flags

- `--mode strict|adaptive`
- `--approval never|risky-only|always`
- `--use-llm true|false`
- `--scenario` / `--file`
- `--param key=value`
- `--artifacts-dir <path>`
- `--json`

## Scenario library

Каталог: `scenarios/library/`.

Минимальные reusable сценарии:
- `search-and-open`
- `download-file`
- `extract-main-text`
- `open-latest-item`

Typed builders:
- `buildSearchAndOpenScenario(params)`
- `buildDownloadFileScenario(params)`
- `buildExtractMainTextScenario(params)`
- `buildOpenLatestItemScenario(params)`

## Approval mode

Режимы:
- `approval=never`
- `approval=risky-only`
- `approval=always`

Risk signals:
- destructive keywords (`Delete`, `Remove`, `Publish`, `Pay`, ...),
- low confidence,
- planner-assisted resolution,
- unknown/out-of-origin navigation.

## Debug artifacts (расширение)

Для CLI/approval добавлены:
- `approval-decision.json`
- `approval-prompt.txt`
- `cli-run-summary.json`
- `library-scenario-metadata.json`
- `execution-timeline.json`

## Config

`RuntimeConfig`:
- `defaultScenariosDir`
- `defaultLibraryDir`
- `defaultReplayMode`
- `defaultApprovalMode`
- `useLlmByDefault`
- `artifactsDir`
- `jsonOutputDefault`

Env overrides:
- `BROWSER_AGENT_SCENARIOS_DIR`
- `BROWSER_AGENT_LIBRARY_DIR`
- `BROWSER_AGENT_REPLAY_MODE`
- `BROWSER_AGENT_APPROVAL_MODE`
- `BROWSER_AGENT_USE_LLM`
- `BROWSER_AGENT_ARTIFACTS_DIR`
- `BROWSER_AGENT_JSON_OUTPUT`

## Тесты

```bash
npm run build
npm run test
npm run test:cli
npm run test:library
```

Основной suite остаётся локальным/воспроизводимым: fixtures + локальный test server, без обязательной реальной Ollama.

## Iteration 7: Real-world hardening

Added hardening layers while keeping core deterministic replay and local reproducible tests:

- **Session/Auth support** via `SessionStore`, `AuthStateLoader/Saver`, `BrowserSessionManager`.
- **Banner/modal handling** via `ConsentBannerResolver` with safe/ambiguous classification.
- **Robust waits** via `PageReadinessEvaluator`, wait strategies (`auto|fast|stable`), and enabled-state waits.
- **Site profiles** via `SiteProfile` + `SiteProfileRegistry` with generic fallback.
- **Review mode** via review summary (`compact|verbose`) integrated in CLI artifacts.
- **Bounded recovery/retry** via `ReplayRecoveryPolicy` and retry traces.
- **Extended debug artifacts** (`site-profile.json`, `session-state-meta.json`, `page-readiness.json`, `retry-trace.json`, `banner-detection.json`, `review-summary.json`, `state-transition-log.json`).

### New CLI flags

- `--session-file <path>`
- `--site-profile <name>`
- `--review verbose|compact`
- `--max-retries <n>`
- `--wait-strategy auto|fast|stable`
- `--auto-consent true|false`

### Real-world local fixtures

`tests/fixtures/realworld/` now includes:
- auth-required-page
- cookie-banner-page
- modal-newsletter-page
- delayed-results-page
- loading-spinner-page
- disabled-then-enabled-page
- nested-menu-page
- dashboard-like-page
- out-of-origin-warning-page
- expired-session-page

### Additional test scripts

- `npm run test:realworld` (integration hardening suite)
- `npm run test:profiles` (profile/session/review/readiness units)
