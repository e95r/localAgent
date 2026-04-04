# Browser Agent MVP (TypeScript + Playwright)

Минимальный, модульный и расширяемый MVP браузерного агента с упором на тестируемость.

## Архитектура

- `BrowserExecutor` — выполнение действий в браузере.
- `PageObserver` — сбор структурированного `PageState`.
- `Planner` (`RuleBasedPlanner`) — выбор следующего действия.
- `ActionValidator` — проверка валидности действия перед исполнением.
- `BrowserAgent` — основной цикл (observe → plan → validate → execute).

## Структура

- `src/types` — интерфейсы и типы действий/состояния.
- `src/executor` — Playwright executor.
- `src/observer` — DOM observer.
- `src/planner` — rule-based planner.
- `src/validator` — validator.
- `src/agent` — orchestration loop.
- `tests/fixtures` — локальные HTML-страницы для воспроизводимых тестов.
- `tests/unit` — unit tests.
- `tests/integration` — integration tests.
- `tests/e2e` — end-to-end сценарии.

## Запуск

```bash
npm install
npx playwright install chromium
npm run test:unit
npm run test:integration
npm run test:e2e
```

Или всё вместе:

```bash
npm run test
```

## Первый этап покрывает

- Открытие страниц, клики, ввод текста, извлечение текста, скриншоты, download event.
- Наблюдение за страницей: url/title/visibleText/interactiveElements.
- Rule-based планирование по целям: скачать / скопировать текст / открыть первую ссылку.
- Валидация действий до выполнения.
- Agent loop с понятным результатом шагов.
- Локальные фикстуры и воспроизводимые тесты.
