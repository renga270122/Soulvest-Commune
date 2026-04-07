# Firebase To PostgreSQL Mapping

This document maps the current Soulvest Commune Firestore structure to the PostgreSQL schema defined in [docs/postgresql-init.sql](docs/postgresql-init.sql).

## Current Firebase Layout

Top-level Firestore collections in active use:

- `users`
- `notifications`
- `societies/{societyId}/visitors`
- `societies/{societyId}/payments`
- `societies/{societyId}/announcements`
- `societies/{societyId}/complaints`
- `societies/{societyId}/facilityBookings`
- `societies/{societyId}/staffAttendance`

Supported but not heavily used yet in active frontend code:

- `cities`
- `societies`
- `societies/{societyId}/apartments`
- `societies/{societyId}/residents`
- `societies/{societyId}/staff`

## Mapping Summary

| Firebase source | PostgreSQL target | Notes |
| --- | --- | --- |
| `cities/{cityId}` | `societies.city`, `societies.state`, optional config tables later | City config is currently lightweight. Keep as society metadata for MVP. |
| `societies/{societyId}` | `societies` | One Firestore society document becomes one `societies` row. |
| `users/{userId}` | `users` | Core identity and role data lives here. |
| `societies/{societyId}/apartments/{aptId}` | `flats` | `unit` maps to `flat_number`. |
| `societies/{societyId}/residents/{residentId}` | `resident_profiles` | Join between `users` and `flats`. |
| `societies/{societyId}/staff/{staffId}` | `staff_profiles` | Guard and staff master data. |
| `societies/{societyId}/staffAttendance/{attendanceId}` | `staff_attendance` | Direct attendance event rows. |
| `societies/{societyId}/visitors/{visitorId}` | `visitors` + `visitor_events` | One document plus expansion of `history[]`. |
| `societies/{societyId}/announcements/{announcementId}` | `announcements` + `announcement_acknowledgements` | One document plus expansion of `acknowledgements[]`. |
| `societies/{societyId}/complaints/{complaintId}` | `complaints` + `complaint_updates` | Core complaint row plus status timeline if present. |
| `societies/{societyId}/payments/{paymentId}` | `invoices` + `payments` + `receipts` | One payment doc may create multiple rows. |
| `societies/{societyId}/facilityBookings/{bookingId}` | `facility_bookings` + `amenities` | `amenity` text should map to an `amenities` row first. |
| `notifications/{notificationId}` | `notifications` | Direct migration with `meta` JSONB. |

## Field-Level Mapping

### 1. `societies/{societyId}` -> `societies`

| Firestore field | PostgreSQL column |
| --- | --- |
| document id | `societies.id` or preserved in a legacy-id column if you want UUID regeneration |
| `name` | `societies.name` |
| `cityId` | derive into `societies.city` or keep in a later `city_code` field |
| `language` | `societies.language` |
| `createdAt` | `societies.created_at` |
| `settings.*` | keep selected values in app config tables later, not required for MVP |

Recommended rule:

- For the demo, migrate one Firestore society into one row and keep `code` as the Firestore `societyId` string.

### 2. `users/{userId}` -> `users`

| Firestore field | PostgreSQL column |
| --- | --- |
| document id | `users.id` or `users.auth_subject` if generating new UUIDs |
| `societyId` | `users.society_id` |
| `email` | `users.email` |
| `mobile` or `phone` | `users.mobile` |
| `name` | `users.full_name` |
| `role` | `users.role` |
| `language` | `users.language` |
| `createdAt` | `users.created_at` |
| `updatedAt` | `users.updated_at` |
| `fcmToken` | move later to a dedicated device-token table if needed |

Important transforms:

- Normalize `role` to one of `resident`, `guard`, `admin`, `staff`.
- Preserve Firebase Auth UID in `auth_subject` if you adopt PostgreSQL UUIDs for local IDs.

### 3. `societies/{societyId}/apartments/{aptId}` -> `flats`

| Firestore field | PostgreSQL column |
| --- | --- |
| document id | optional legacy apartment id |
| `floor` | `flats.floor_no` |
| `unit` | `flats.flat_number` |
| `status` | `flats.occupancy_status` |

### 4. `societies/{societyId}/residents/{residentId}` -> `resident_profiles`

| Firestore field | PostgreSQL column |
| --- | --- |
| `userId` | `resident_profiles.user_id` |
| `aptId` | `resident_profiles.flat_id` |
| `role` | `resident_profiles.resident_type` |
| `active` | derive into current occupancy / status decisions |

Recommended rule:

- If resident master data is incomplete in Firestore, you can derive `resident_profiles` from `users.flat` plus apartment lookup during migration.

### 5. `societies/{societyId}/staff/{staffId}` -> `staff_profiles`

| Firestore field | PostgreSQL column |
| --- | --- |
| `name` | `staff_profiles.staff_code` only if code exists separately; otherwise use users full name |
| `type` | `staff_profiles.staff_type` |
| `shift` | `staff_profiles.shift_name` |
| `active` | `staff_profiles.active` |

Recommended rule:

- If staff members already have `users` rows, connect them with `staff_profiles.user_id`.

### 6. `societies/{societyId}/staffAttendance/{attendanceId}` -> `staff_attendance`

| Firestore field | PostgreSQL column |
| --- | --- |
| `userId` | `staff_attendance.user_id` |
| `shift` | `staff_attendance.shift_name` |
| `status` | `staff_attendance.status` |
| `clockInAt` | `staff_attendance.clock_in_at` |
| `clockOutAt` | `staff_attendance.clock_out_at` |
| `notes` | `staff_attendance.notes` |
| `createdAt` | `staff_attendance.created_at` |
| `updatedAt` | `staff_attendance.updated_at` |

### 7. `societies/{societyId}/visitors/{visitorId}` -> `visitors` + `visitor_events`

`visitors` is a split migration.

| Firestore field | PostgreSQL column |
| --- | --- |
| `residentId` | `visitors.resident_user_id` |
| `flat` | resolve to `visitors.flat_id` |
| `name` or `visitorName` | `visitors.visitor_name` |
| `phone` | `visitors.mobile` |
| `purpose` | `visitors.purpose` |
| `entryMethod` | `visitors.entry_method` |
| `status` | `visitors.status` |
| `otp` | `visitors.otp_code` |
| `passToken` or `qrPayload` | `visitors.qr_token` |
| `expectedAt` | `visitors.expected_at` |
| `passExpiresAt` | `visitors.pass_expires_at` |
| `checkedInAt` | `visitors.checked_in_at` |
| `exitTime` or `checkedOutAt` | `visitors.checked_out_at` |
| `notes` | `visitors.notes` |
| `createdAt` | `visitors.created_at` |
| `updatedAt` | `visitors.updated_at` |

History expansion:

- Firestore `history[]` becomes one row per item in `visitor_events`.
- `history[n].type` -> `visitor_events.event_type`
- `history[n].actor` -> `visitor_events.actor_name`
- `history[n].at` -> `visitor_events.created_at`

Recommended rule:

- Treat Firestore `status` as the current snapshot, and treat `history[]` as the event ledger.

### 8. `societies/{societyId}/announcements/{announcementId}` -> `announcements` + `announcement_acknowledgements`

| Firestore field | PostgreSQL column |
| --- | --- |
| `title` | `announcements.title` |
| `body` | `announcements.body` |
| `audience` | `announcements.audience` |
| `pinned` | `announcements.pinned` |
| `postedBy` | `announcements.posted_by` |
| `createdAt` | `announcements.created_at` and `published_at` |
| `updatedAt` | `announcements.updated_at` |

Acknowledgement expansion:

- Firestore `acknowledgements[]` becomes rows in `announcement_acknowledgements`.
- `acknowledgements[n].userId` -> `announcement_acknowledgements.user_id`
- `acknowledgements[n].at` -> `announcement_acknowledgements.acknowledged_at`

### 9. `societies/{societyId}/complaints/{complaintId}` -> `complaints` + `complaint_updates`

| Firestore field | PostgreSQL column |
| --- | --- |
| `residentId` | `complaints.resident_user_id` |
| `flat` | resolve to `complaints.flat_id` |
| `category` | `complaints.category` |
| `title` | `complaints.title` |
| `description` | `complaints.description` |
| `aiPriority` or `priority` | `complaints.priority` |
| `status` | `complaints.status` |
| `assignedTo` | `complaints.assigned_to` |
| `createdAt` | `complaints.created_at` and `opened_at` |
| `resolvedAt` | `complaints.resolved_at` |
| `updatedAt` | `complaints.updated_at` |

If your complaint documents contain comments or status history arrays later:

- Move each item into `complaint_updates`.

### 10. `societies/{societyId}/payments/{paymentId}` -> `invoices` + `payments` + `receipts`

This is the most important split.

#### A. Firestore payment doc -> `invoices`

| Firestore field | PostgreSQL column |
| --- | --- |
| `userId` or `residentId` | `invoices.resident_user_id` |
| `flat` | resolve to `invoices.flat_id` |
| `title` | `invoices.title` |
| `description` | `invoices.description` |
| `month` | `invoices.billing_month` |
| `year` | `invoices.billing_year` |
| `dueDate` | `invoices.due_date` |
| `status` | `invoices.status` |
| `amount` | `invoices.total_amount` and `subtotal` |
| `createdAt` | `invoices.created_at` |
| `updatedAt` | `invoices.updated_at` |

Suggested invoice number:

- Generate one if Firestore does not have a proper invoice code, for example `INV-${year}-${month}-${paymentId short}`.

#### B. Firestore payment doc -> `payments`

Only create a `payments` row when the Firestore document represents an actual payment event or has `status = paid`.

| Firestore field | PostgreSQL column |
| --- | --- |
| `userId` or `residentId` | `payments.resident_user_id` |
| `amount` or `paidAmount` | `payments.amount` |
| `method` or `paymentMethod` | `payments.payment_method` |
| `paymentReference` | `payments.transaction_ref` |
| `razorpayOrderId` | `payments.provider_order_id` |
| `providerPaymentId` | `payments.provider_payment_id` |
| `status` | `payments.status` |
| `paidAt` | `payments.paid_at` |

#### C. Firestore payment doc -> `receipts`

If the document contains receipt data:

| Firestore field | PostgreSQL column |
| --- | --- |
| `receiptNumber` | `receipts.receipt_number` |
| `receiptIssuedAt` | `receipts.issued_at` |

#### D. Optional `invoice_items`

If Firestore `breakdown` exists as an object like:

```json
{
  "Security": 40,
  "Housekeeping": 25,
  "Utilities": 20,
  "Other": 15
}
```

Then create `invoice_items` rows from that object. If the values are percentages rather than rupee amounts, convert them before insert.

### 11. `societies/{societyId}/facilityBookings/{bookingId}` -> `amenities` + `facility_bookings`

This is another split migration.

#### A. Distinct amenity names -> `amenities`

Extract unique Firestore `amenity` values and seed them into `amenities`.

Examples:

- `Gym`
- `Pool`
- `Clubhouse`

Suggested `amenities.code` rule:

- lowercase slug of the amenity name, for example `clubhouse`, `gym`, `pool`

#### B. Booking document -> `facility_bookings`

| Firestore field | PostgreSQL column |
| --- | --- |
| `residentId` | `facility_bookings.resident_user_id` |
| `flat` | resolve to `facility_bookings.flat_id` |
| `amenity` | resolve to `facility_bookings.amenity_id` |
| `bookingDate` | `facility_bookings.booking_date` |
| `slot` | split into `slot_start` and `slot_end` |
| `status` | `facility_bookings.status` |
| `notes` | `facility_bookings.notes` |
| `createdAt` | `facility_bookings.created_at` |
| `updatedAt` | `facility_bookings.updated_at` |

Important transform:

- Firestore `slot` is currently a string. You must parse it into `slot_start` and `slot_end` for PostgreSQL.

### 12. `notifications/{notificationId}` -> `notifications`

| Firestore field | PostgreSQL column |
| --- | --- |
| `societyId` | `notifications.society_id` |
| `userId` | `notifications.user_id` |
| `title` | `notifications.title` |
| `message` | `notifications.message` |
| `type` | `notifications.type` |
| `read` | `notifications.read` |
| all extra fields | `notifications.meta` |
| `createdAt` | `notifications.created_at` |
| `updatedAt` | `notifications.updated_at` |

Recommended rule:

- Preserve non-core fields like `visitorId`, `complaintId`, `channels`, `flat`, and `visitorName` inside `meta` JSONB.

## Migration Order

Use this order to avoid foreign-key issues:

1. `societies`
2. `users`
3. `flats`
4. `resident_profiles`
5. `staff_profiles`
6. `amenities`
7. `announcements`
8. `complaints`
9. `invoices`
10. `payments`
11. `receipts`
12. `facility_bookings`
13. `visitors`
14. `visitor_events`
15. `staff_attendance`
16. `announcement_acknowledgements`
17. `complaint_updates`
18. `notifications`
19. `audit_logs` only if you backfill from historical data

## Migration Rules That Matter

### Preserve Firebase IDs

For the demo, the safest option is:

- keep PostgreSQL UUID primary keys generated by Postgres for new records
- store Firebase document IDs in a `legacy_id` column if you want reversible migration

If you want exact ID continuity instead, you will need UUID-compatible values or separate external-id columns.

### Normalize flats before lookup

Current frontend logic already normalizes flat values to uppercase trimmed strings.

Migration rule:

- always normalize Firebase flat values before resolving `flat_id`

### Split Firestore arrays into child tables

Do not keep these as JSON unless you have no choice:

- `visitor.history[]` -> `visitor_events`
- `announcement.acknowledgements[]` -> `announcement_acknowledgements`
- complaint timeline/comments -> `complaint_updates`

### Convert object blobs carefully

Common object-style fields needing transformation:

- payment `breakdown` -> `invoice_items`
- notification extra fields -> `notifications.meta`
- society `settings` -> keep for later config tables or app config JSON

## What Not To Migrate 1:1

These should be re-modeled, not copied blindly:

- Firestore `razorpayOrderId` inside payment documents: move into `payments.provider_order_id`
- Firestore combined payment document: split across `invoices`, `payments`, `receipts`
- Firestore `slot` strings: parse into start and end times
- Firestore `acknowledgements` arrays: expand to rows

## Practical First Migration Scope

For the first Soulvest Commune PostgreSQL demo, migrate only these live modules:

- `users`
- `societies`
- `visitors`
- `visitor_events`
- `announcements`
- `complaints`
- `payments` via `invoices`, `payments`, `receipts`
- `facility_bookings`
- `staff_attendance`
- `notifications`

Leave lower-value or partially used collections like `apartments`, `residents`, and `staff` for cleanup if the source data is incomplete.