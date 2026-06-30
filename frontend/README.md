# Frontend - Blood Pressure Tracker

## Setup

1. Copy `.env.example` to `.env`
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_BACKEND_URL`
3. Run `npm install`
4. Start the app with `npm run dev`

## Notes

- Uses Supabase Auth for email/password and Google sign-in.
- Contacts backend at `VITE_BACKEND_URL` for measurement CRUD.
