# Browser Agent MVP (TypeScript + Playwright)

Проект на **Iteration 5**: к существующей deterministic/hybrid архитектуре добавлены **Recorder + Scenario Replay**.

## Архитектура (Iteration 5)

Базовые принципы Iteration 4 сохранены:
- deterministic planner first,
- LLM fallback second,
- validator authoritative,
- `ask_user` на небезопасных/неоднозначных шагах.

Новые слои Iteration 5:
- `ScenarioRecorder` — запись шагов сценария из наблюдаемого `PageState`.
- `ScenarioStore` — сохранение/загрузка JSON-сценариев и schema validation.
- `ReplayTargetResolver` — strict/fallback/semantic target resolution + confidence.
- `ScenarioRunner` — последовательный replay в режимах `strict` и `adaptive`.
- `post-step verification` — проверка expected outcome после каждого шага.
- расширенные replay debug artifacts.

> Основной test-suite остаётся локальным и воспроизводимым: без внешних сайтов и без обязательной реальной Ollama.

## Новые модули

- `src/scenario/types.ts`
- `src/scenario/schema.ts`
- `src/recorder/scenario-recorder.ts`
- `src/storage/scenario-store.ts`
- `src/replay/target-resolver.ts`
- `src/replay/post-step-verifier.ts`
- `src/replay/scenario-runner.ts`

## Формат сценария (JSON)

```json
{
  "schemaVersion": "1.0.0",
  "id": "scenario-id",
  "name": "Search and open docs",
  "createdAt": "2026-04-05T00:00:00.000Z",
  "updatedAt": "2026-04-05T00:00:00.000Z",
  "metadata": {
    "sourceUrl": "http://127.0.0.1:3000/replay-stable-page.html",
    "startUrl": "http://127.0.0.1:3000/replay-stable-page.html",
    "description": "optional"
  },
  "steps": [
    {
      "stepId": "step-1",
      "action": { "actionType": "click" },
      "pageUrlAtRecordTime": "http://127.0.0.1:3000/replay-stable-page.html",
      "target": {
        "strictSelectors": ["#search-btn"],
        "fallbackSelectors": ["button[aria-label=\"Search\"]"],
        "text": "Search",
        "ariaLabel": "Search"
      },
      "postActionExpectation": { "textVisible": "Search complete" }
    }
  ]
}
```

## Replay режимы

### `strict`
- использует только strict selectors;
- без semantic guessing;
- если target не найден — fail/ask_user.

### `adaptive`
Порядок resolution:
1. strict selector,
2. fallback selectors,
3. semantic snapshot matching,
4. optional planner-assisted fallback,
5. `ask_user` при низкой уверенности или ambiguity.

## Recorder API

```ts
const recorder = new ScenarioRecorder();
recorder.startRecording('Search flow', startUrl);
recorder.recordStep({ actionType: 'type', pageState, target, value: 'cats' });
recorder.recordStep({ actionType: 'submit_search', pageState, target: submitBtn, mode: 'button' });
const scenario = recorder.stopRecording();
```

## Persistence API

```ts
await saveScenarioToFile('scenarios/search.json', scenario);
const loaded = await loadScenarioFromFile('scenarios/search.json');
```

## Replay API

```ts
const runner = new ScenarioRunner({ executor, observer, validator });
const replay = await runner.runScenario(loadedScenario, { mode: 'adaptive', maxRetriesPerStep: 1 });
```

## Replay debug artifacts

При failure создаются:
- `scenario.json`
- `replay-mode.json`
- `replay-step-results.json`
- `target-resolution.json`
- `replay-failure-reason.txt`
- `expected-vs-actual.json`

## Fixtures для replay

- `replay-stable-page.html`
- `replay-shifted-page.html`
- `replay-broken-page.html`
- `replay-search-page.html`
- `replay-download-page.html`
- `replay-article-page.html`

## Запуск тестов

### Полный suite

```bash
npm run build
npm run test
```

### Replay-focused

```bash
npm run test:replay
```

### Опциональные smoke tests с реальной Ollama

```bash
OLLAMA_SMOKE=1 OLLAMA_ENABLED=true npm run test:ollama
```
