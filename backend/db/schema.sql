-- Supabase schema for blood pressure tracking

create table if not exists measurements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null,
  date date not null,
  systolic int not null,
  diastolic int not null,
  pulse int not null,
  notes text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

create index if not exists idx_measurements_user_date on measurements (user_id, date);
