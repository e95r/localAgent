# Browser Agent MVP (TypeScript + Playwright)

Итерация 4: deterministic/hybrid архитектура сохранена, добавлен реальный `LocalLlmClient` (Ollama HTTP API) как opt-in путь.

## Архитектура (Iteration 4)

- `RuleBasedPlanner` — основной deterministic planner.
- `HybridPlanner` — сначала deterministic, потом `LlmPlanner` fallback.
- `ActionValidator` — authoritative guardrail на любые действия.
- `LlmPlanner` + строгий JSON контракт — основной слой структурной валидации LLM-ответа.
- `FakeLlmClient` остаётся базой для unit/integration/e2e.
- `LocalLlmClient` теперь реализован через Ollama (`OllamaLlmClient`).

> Базовый suite по-прежнему не зависит от локально запущенной модели.

## Новые модули Iteration 4

- `src/llm/ollama-config.ts` — typed config + env parsing + validation.
- `src/llm/ollama-response.ts` — extraction/sanitization (fenced JSON, лишний текст, partial JSON).
- `src/llm/ollama-client.ts` — реальный HTTP клиент с timeout/retry/error mapping.
- `src/llm/llm-client-factory.ts` — `createLlmClientFromConfig` / `createLlmClientFromEnv`.
- `src/llm/local-llm-client.ts` — backward-compatible alias на Ollama клиент.

## Ollama config (env)

Поддерживаются:

- `OLLAMA_ENABLED` (`true/false`)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default `qwen2.5:7b-instruct`)
- `OLLAMA_TIMEOUT_MS` (default `12000`)
- `OLLAMA_TEMPERATURE` (default `0`)
- `OLLAMA_NUM_PREDICT` (default `320`)
- `OLLAMA_RETRIES` (default `1`)
- `OLLAMA_KEEP_ALIVE` (optional)
- `OLLAMA_ENABLE_JSON_MODE` (default `true`)

### Recommended preset

Стартовый практичный preset:

- модель: `qwen2.5:7b-instruct` (или `qwen2.5:14b-instruct` при ресурсах)
- `OLLAMA_TEMPERATURE=0`
- `OLLAMA_ENABLE_JSON_MODE=true`
- `OLLAMA_RETRIES=1`

## Подключение реального LLM клиента

```ts
import { createLlmClientFromEnv, LlmPlanner, HybridPlanner, RuleBasedPlanner, withPlannerConfig } from 'browser-agent-mvp';

const llmClient = createLlmClientFromEnv(process.env);
const llmPlanner = new LlmPlanner(llmClient, [
  'DownloadCapability',
  'OpenRelevantLinkCapability',
  'ExtractMainContentCapability',
  'SelectListItemCapability',
]);

const planner = new HybridPlanner(
  new RuleBasedPlanner(),
  llmPlanner,
  withPlannerConfig({ enableLlmFallback: true }),
);
```

Если `OLLAMA_ENABLED=false`, можно явно передать `FakeLlmClient` через factory fallback.

## Debug artifacts (расширение)

Когда LLM путь используется, добавляются:

- `llm-client-metadata.json` (model/baseUrl/timeout/retries/jsonMode/retryAttempts)
- `llm-sanitized-response.txt`
- `llm-parse-error.txt` (если есть)
- + существующие `llm-prompt.txt`, `llm-raw-response.txt`, `llm-parsed-response.json`

## Запуск Ollama локально

Пример:

```bash
# 1) запустить ollama server
ollama serve

# 2) скачать модель
ollama pull qwen2.5:7b-instruct

# 3) включить клиент
export OLLAMA_ENABLED=true
export OLLAMA_MODEL=qwen2.5:7b-instruct
export OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## Тесты

### Основной suite (без реального Ollama)

```bash
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
```

### Опциональные smoke tests с реальным Ollama

По умолчанию эти тесты пропускаются.

```bash
OLLAMA_SMOKE=1 OLLAMA_ENABLED=true npm run test:ollama
```

Smoke tests проверяют:
- минимальный strict JSON path,
- planner path с реальным ответом,
- clean failure при неверной модели/недоступном сервере.
