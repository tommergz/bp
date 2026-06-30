# Backend - Blood Pressure Tracker

## Setup

1. Copy `.env.example` to `.env`
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Run `npm install`
4. Start the app with `npm start`

## Endpoints

- `GET /health`
- `GET /api/measurements?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/measurements`
- `PUT /api/measurements/:id`
- `DELETE /api/measurements/:id`

## Authentication

Send `Authorization: Bearer <access_token>` from Supabase auth in each request.
