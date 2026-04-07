begin;

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists societies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  city text,
  state text,
  country text not null default 'India',
  timezone text not null default 'Asia/Kolkata',
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  auth_provider text not null default 'firebase',
  auth_subject text,
  email text,
  mobile text,
  full_name text not null,
  role text not null check (role in ('resident', 'guard', 'admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_society_email_uidx
  on users(society_id, email)
  where email is not null;

create unique index if not exists users_society_mobile_uidx
  on users(society_id, mobile)
  where mobile is not null;

create table if not exists flats (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  block_name text,
  floor_no integer,
  flat_number text not null,
  flat_type text,
  square_feet numeric(10,2),
  occupancy_status text not null default 'occupied' check (occupancy_status in ('occupied', 'vacant', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (society_id, flat_number)
);

create table if not exists resident_profiles (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete restrict,
  resident_type text not null default 'owner' check (resident_type in ('owner', 'tenant', 'family_member')),
  is_primary boolean not null default false,
  move_in_date date,
  move_out_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists resident_profiles_primary_per_flat_uidx
  on resident_profiles(flat_id)
  where is_primary = true;

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  resident_user_id uuid references users(id) on delete set null,
  flat_id uuid references flats(id) on delete set null,
  visitor_name text not null,
  mobile text,
  purpose text,
  visit_type text not null default 'guest' check (visit_type in ('guest', 'delivery', 'cab', 'maintenance', 'other')),
  entry_method text not null default 'walk_in' check (entry_method in ('walk_in', 'preapproved', 'qr', 'otp')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'preapproved', 'checked_in', 'checked_out', 'expired')),
  otp_code text,
  qr_token text,
  expected_at timestamptz,
  pass_expires_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  notes text,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  checked_in_by uuid references users(id) on delete set null,
  checked_out_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visitors_society_status_idx on visitors(society_id, status);
create index if not exists visitors_society_flat_idx on visitors(society_id, flat_id);
create index if not exists visitors_society_expected_idx on visitors(society_id, expected_at);

create table if not exists visitor_events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  visitor_id uuid not null references visitors(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'approved', 'denied', 'preapproved', 'checked_in', 'checked_out', 'expired')),
  actor_user_id uuid references users(id) on delete set null,
  actor_name text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  staff_code text,
  staff_type text not null default 'guard' check (staff_type in ('guard', 'housekeeping', 'technician', 'manager', 'other')),
  shift_name text not null default 'general',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (society_id, staff_code)
);

create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  staff_profile_id uuid references staff_profiles(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  shift_name text,
  status text not null check (status in ('clocked_in', 'clocked_out')),
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'residents', 'staff', 'guards')),
  pinned boolean not null default false,
  posted_by uuid references users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists announcement_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_text text not null
);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  resident_user_id uuid not null references users(id) on delete restrict,
  flat_id uuid references flats(id) on delete set null,
  category text not null,
  title text,
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references users(id) on delete set null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_society_status_idx on complaints(society_id, status);
create index if not exists complaints_society_resident_idx on complaints(society_id, resident_user_id);

create table if not exists complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  update_type text not null check (update_type in ('comment', 'status_change', 'assignment', 'resolution')),
  message text,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create table if not exists charge_heads (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  code text not null,
  name text not null,
  charge_type text not null check (charge_type in ('maintenance', 'rent', 'amenity', 'penalty', 'utility', 'other')),
  active boolean not null default true,
  unique (society_id, code)
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  resident_user_id uuid not null references users(id) on delete restrict,
  flat_id uuid references flats(id) on delete set null,
  invoice_number text not null,
  title text not null,
  description text,
  billing_month integer,
  billing_year integer,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'part_paid', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(12,2) not null default 0,
  late_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (society_id, invoice_number)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  charge_head_id uuid references charge_heads(id) on delete set null,
  item_name text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  line_amount numeric(12,2) not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  resident_user_id uuid not null references users(id) on delete restrict,
  amount numeric(12,2) not null,
  payment_method text not null check (payment_method in ('upi', 'cash', 'bank_transfer', 'card', 'cheque')),
  provider text,
  provider_payment_id text,
  provider_order_id text,
  provider_signature text,
  transaction_ref text,
  status text not null default 'initiated' check (status in ('initiated', 'success', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  unique (society_id, receipt_number)
);

create table if not exists amenities (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  booking_required boolean not null default true,
  active boolean not null default true,
  unique (society_id, code)
);

create table if not exists facility_bookings (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  amenity_id uuid not null references amenities(id) on delete restrict,
  resident_user_id uuid not null references users(id) on delete restrict,
  flat_id uuid references flats(id) on delete set null,
  booking_date date not null,
  slot_start time not null,
  slot_end time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facility_bookings_society_date_idx
  on facility_bookings(society_id, booking_date);

create unique index if not exists facility_booking_slot_uidx
  on facility_bookings(amenity_id, booking_date, slot_start, slot_end)
  where status = 'confirmed';

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx
  on notifications(user_id, read, created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

drop trigger if exists societies_set_updated_at on societies;
create trigger societies_set_updated_at before update on societies
for each row execute function set_updated_at();

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
for each row execute function set_updated_at();

drop trigger if exists flats_set_updated_at on flats;
create trigger flats_set_updated_at before update on flats
for each row execute function set_updated_at();

drop trigger if exists resident_profiles_set_updated_at on resident_profiles;
create trigger resident_profiles_set_updated_at before update on resident_profiles
for each row execute function set_updated_at();

drop trigger if exists visitors_set_updated_at on visitors;
create trigger visitors_set_updated_at before update on visitors
for each row execute function set_updated_at();

drop trigger if exists staff_profiles_set_updated_at on staff_profiles;
create trigger staff_profiles_set_updated_at before update on staff_profiles
for each row execute function set_updated_at();

drop trigger if exists staff_attendance_set_updated_at on staff_attendance;
create trigger staff_attendance_set_updated_at before update on staff_attendance
for each row execute function set_updated_at();

drop trigger if exists announcements_set_updated_at on announcements;
create trigger announcements_set_updated_at before update on announcements
for each row execute function set_updated_at();

drop trigger if exists polls_set_updated_at on polls;
create trigger polls_set_updated_at before update on polls
for each row execute function set_updated_at();

drop trigger if exists complaints_set_updated_at on complaints;
create trigger complaints_set_updated_at before update on complaints
for each row execute function set_updated_at();

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at before update on invoices
for each row execute function set_updated_at();

drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at before update on payments
for each row execute function set_updated_at();

drop trigger if exists facility_bookings_set_updated_at on facility_bookings;
create trigger facility_bookings_set_updated_at before update on facility_bookings
for each row execute function set_updated_at();

drop trigger if exists notifications_set_updated_at on notifications;
create trigger notifications_set_updated_at before update on notifications
for each row execute function set_updated_at();

commit;