# Browser Agent MVP (TypeScript + Playwright)

Итерация 2: capability-driven архитектура, explainability, safety-валидация и debug artifacts.

## Архитектура Iteration 2

- `BrowserExecutor` — действия Playwright + доступ к HTML/скриншотам.
- `PageObserver` — расширенный `PageState` (тип элемента, clickable, overlay hints, container hints, value, aria/placeholder и т.д.).
- `Capability` + `CapabilityRegistry` — изолированные модули логики действий.
- `RuleBasedPlanner` — ранжирует capability по confidence, выбирает top candidate или возвращает `ask_user`.
- `ActionValidator` — проверяет существование/видимость/enabled/clickable/overlay/search-submit safety.
- `BrowserAgent` — многошаговый цикл с history, loop protection и debug artifact hooks.

## Capabilities

- `ClosePopupCapability`
- `DownloadCapability`
- `FillSearchInputCapability`
- `SubmitSearchCapability`
- `OpenRelevantLinkCapability`
- `SelectListItemCapability`
- `ExtractMainContentCapability`

Каждое решение planner возвращает:
- `action`
- `confidence`
- `reason`
- `candidateTargets`
- `selectedCapabilityName`

Если уверенность низкая или есть неоднозначность — planner возвращает `ask_user`.

## Debug artifacts

Включаются через `BrowserAgent` config:

```ts
new BrowserAgent({
  ...deps,
  debugArtifacts: { enabled: true, outputDir: 'debug-artifacts' },
});
```

При `ask_user`, validator rejection, ambiguity/loop сохраняются:
- `screenshot.png`
- `current.html`
- `page-state.json`
- `planner-output.json`
- `validator-result.json`
- `action-history.json`

## Fixtures

Добавлены фикстуры:
- `popup-download.html`
- `search-page.html`
- `ambiguous-search-page.html`
- `list-page.html`
- `multi-article-page.html`
- `disabled-download-page.html`
- `stubborn-download.html`

## Запуск

```bash
npm install
npx playwright install chromium
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
# или все вместе
npm run test
```
