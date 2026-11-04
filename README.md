# Habits вместе

Групповой трекер привычек. Клиентское приложение (Vite + React + Tailwind) для GitHub Pages: [https://seilovamirali.github.io/habits/](https://seilovamirali.github.io/habits/).

База та же, что у опубликованного Lovable-приложения: Supabase `rveijqsmfzncelpexlmm`. Схема не меняется. В репозитории только публичный publishable-ключ. PDF книги в git не хранится: он лежит в приватном бакете `book` (`gulen-glubina.pdf`) и открывается по временной ссылке после входа.

## Локально

```bash
npm install
npm run dev
```

Сайт открывается на `http://localhost:5173/habits/`.

```bash
npm test
npm run build
npm run preview
```

## Деплой

Пуш в `main` запускает `.github/workflows/pages.yml`: тесты, сборка и публикация в GitHub Pages. Источник Pages должен быть **GitHub Actions**.

Прямые ссылки вроде `/habits/today` обслуживает `404.html` (копия `index.html`), поэтому обновление страницы не теряет маршрут.
