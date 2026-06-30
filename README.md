# Blood Pressure and Pulse Tracker

Это приложение состоит из двух частей:

- `backend/` — Node.js + Express API, работающий с Supabase
- `frontend/` — React + Vite клиент для работы с измерениями

## Требования

- Node.js 18+ (рекомендуется)
- npm
- аккаунт Supabase

## Настройка Supabase

1. Создайте проект на Supabase.
2. Включите Authentication: Email/Password и провайдер Google (если нужен Google login).
3. Скопируйте `anon` ключ и `URL` вашего проекта для frontend.
4. Скопируйте `service_role` ключ для backend.
5. Создайте таблицу `measurements` с полями:
   - `id` UUID primary key
   - `user_id` UUID
   - `date` date
   - `systolic` int
   - `diastolic` int
   - `pulse` int
   - `notes` text
   - `created_at` timestamp with time zone default timezone('utc', now())

## Запуск backend

1. Перейдите в папку backend:
   ```powershell
   cd backend
   ```
2. Установите зависимости:
   ```powershell
   npm install
   ```
3. Создайте `.env` на основе `.env.example` и заполните:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (например, `4000`)
4. Запустите сервер:
   ```powershell
   npm start
   ```

## Запуск frontend

1. Перейдите в папку frontend:
   ```powershell
   cd frontend
   ```
2. Установите зависимости:
   ```powershell
   npm install
   ```
3. Создайте `.env` на основе `.env.example` и заполните:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL` (например, `http://localhost:4000`)
4. Запустите клиент:
   ```powershell
   npm run dev
   ```

## Примечания

- Для авторизации frontend использует Supabase Auth.
- Backend проверяет токен пользователя и работает с таблицей `measurements`.
- При деплое на Render укажите переменные окружения для каждого сервиса.

## Деплой на Render

1. Войдите в Render и создайте новый проект из GitHub-репозитория.
2. Добавьте два сервиса:
   - `bp-backend` — web service, Node
   - `bp-frontend` — static site
3. Для `bp-backend` задайте:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Environment Variables:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
4. Для `bp-frontend` задайте:
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`
   - Environment Variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_BACKEND_URL`
5. В Render укажите `VITE_BACKEND_URL` как URL бэкенда, который Render выдаст после деплоя backend.
6. После деплоя frontend будет доступен по адресу Render static site.
