# Browser Agent MVP (TypeScript + Playwright)

Итерация 3: deterministic rule-based planning + HybridPlanner + LLM fallback (через абстракцию клиента), строгий JSON-контракт ответа и расширенные debug artifacts.

## Архитектура Iteration 3

- `RuleBasedPlanner` — основной deterministic planner из Iteration 2.
- `LlmPlanner` — формирует prompt, получает strict JSON и возвращает только структурированное действие.
- `HybridPlanner` — orchestration слой:
  1. пробует `RuleBasedPlanner`;
  2. при низком confidence/ambiguity вызывает `LlmPlanner`;
  3. если LLM тоже неуверен/невалиден — `ask_user`.
- `ActionValidator` остаётся authoritative: отклоняет невозможные/небезопасные действия, включая ошибочные `targetId` от LLM.
- `BrowserAgent` выполняет только валидные действия, хранит history/loop-protection и trace источника планирования (`plannerSource`).

## LLM abstraction

- `LlmClient` interface (`generateAction(input): Promise<string>`)
- `FakeLlmClient` для unit/integration/e2e тестов (без реальной модели)
- `LocalLlmClient` placeholder adapter

Тесты **не зависят от реальной LLM**.

## JSON response contract

LLM должна вернуть JSON-объект со структурой:

- `selectedCapabilityName`
- `action`
- `targetId` (если требуется)
- `text` (для `type`)
- `confidence`
- `reason`
- `candidateTargets`
- `warnings` (optional)

Парсер/валидатор (`parseLlmPlannerResponse`, `validateLlmPlannerResponse`) строго отклоняет:
- invalid JSON
- неизвестные action
- обязательные поля, которых нет
- некорректные значения

## Planner config

`src/planner/planner-config.ts`:

- `enableLlmFallback`
- `ruleConfidenceThreshold`
- `llmConfidenceThreshold`
- `saveLlmArtifacts`
- `maxPlannerRetries`

Есть разумные default значения и helper `withPlannerConfig`.

## Debug artifacts

При ошибках/ambiguity/validator rejection сохраняются стандартные артефакты + LLM расширения:

- `planner-source.json`
- `llm-prompt.txt`
- `llm-raw-response.txt`
- `llm-parsed-response.json`

## Fixtures

Дополнительные фикстуры Iteration 3:

- `ambiguous-download-choice.html`
- `semantic-link-choice.html`
- `multi-content-page.html`
- `list-latest-item.html`
- `invalid-llm-target-page.html`

## Запуск

```bash
npm install
npx playwright install chromium
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
```

> В unit/integration/e2e для LLM используется fake/stub client.
