# MineSafe Security Specification — Phase 0 (Payload-First TDD)

## 1. Data Invariants

1. **Identity & Email Verification:** Unauthenticated clients (`request.auth == null`) and users with unverified email addresses (`request.auth.token.email_verified != true`) CANNOT write to any Firestore collection or RTDB protected path.
2. **PII Isolation (`users`):** Email addresses, RUTs, and shift assignments are PII. Reading `/users/{userId}` is strictly limited to `request.auth.uid == userId` or verified admins (`/admins/$(request.auth.uid)` or primary admin email with `email_verified == true`). Blanket `list` queries on `/users` by non-admins are forbidden.
3. **Anti-Self-Registration & Anti-Privilege Escalation:** Public client-side self-registration on `/users/{userId}` is forbidden. Creating `/users/{userId}`, creating `/admins/{adminId}`, or changing RBAC fields (`role`, `isSuperUser`, `organizationId`, `status`) requires a verified `admin` or `superadmin`. Standard users updating their own non-privileged fields CANNOT assign `role: 'superadmin'`, `role: 'admin'`, `isSuperUser: true`, or alter organization membership.
4. **Master Gate & Anti-Orphan Invariants:**
   - Every `/attachments/{attachmentId}` MUST reference an existing `/alerts/{alertId}` via `exists(...)` on `create` and carry `ownerId == request.auth.uid`, `sizeBytes <= 5242880` (5 MB), and an allowlisted MIME type (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
   - Every `/alerts/{alertId}`, `/devices/{deviceId}`, `/rentals/{rentalId}`, and `/organizations/{organizationId}` MUST enforce `ownerId == request.auth.uid` on creation.
5. **Path Variable & Payload Size Hardening:** Document IDs MUST match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars. Every `string` and `list` field enforces explicit `.size()` bounds. Unrecognized "shadow/ghost" fields are rejected via `keys().hasAll(...) && keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
6. **Terminal State Locking & Immutability:**
   - Once an alert reaches `status == 'resuelta'` (`resolved == true`), non-admin users CANNOT reopen or alter its historical record.
   - `createdAt`, `ownerId`, and `id` MUST remain immutable across updates (`incoming().ownerId == existing().ownerId`, `incoming().createdAt == existing().createdAt`).
7. **Temporal Integrity:** All `createdAt` on create and `updatedAt` on update MUST equal server `request.time`.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Expect `PERMISSION_DENIED`)

1. **DD-01 Unauthenticated Write (Firestore `/alerts` & RTDB `/alertas`):**
   - Actor: `auth = null`
   - Target: `POST /alerts/evt_forged_1` `{ "id": "evt_forged_1", "title": "Fake alert" }`
2. **DD-02 Email Verification Bypass (Unverified Admin Spoof):**
   - Actor: `{ uid: "attacker", token: { email: "manuelcrisostomovega@gmail.com", email_verified: false } }`
   - Target: `WRITE /admins/attacker` `{ "uid": "attacker", "email": "manuelcrisostomovega@gmail.com", "role": "superadmin" }`
3. **DD-03 Self-Privilege Escalation on User Profile:**
   - Actor: Authenticated verified user `uid = "op_01"` (`role = "operador"`)
   - Target: `CREATE /users/op_01` with `"role": "superadmin"`
4. **DD-04 PII Cross-User Snooping:**
   - Actor: Authenticated verified operator `uid = "op_01"`
   - Target: `GET /users/op_02`
5. **DD-05 Shadow / Ghost Field Injection (`isVerified: true`):**
   - Actor: Verified owner `uid = "op_01"`
   - Target: `CREATE /alerts/alt_shadow_1` containing valid required fields PLUS `"isVerified": true` or `"shadowAdmin": true`
6. **DD-06 ID Poisoning (1.5 KB Document ID / Invalid Characters):**
   - Actor: Verified user `uid = "op_01"`
   - Target: `CREATE /devices/${"A".repeat(300)}` or `/devices/bad$id`
7. **DD-07 Owner Identity Spoofing:**
   - Actor: Verified user `uid = "op_01"`
   - Target: `CREATE /devices/dev_spoof_1` with `"ownerId": "someone_else_uid"`
8. **DD-08 Immutable `ownerId` / `createdAt` Mutation on Update:**
   - Actor: Verified owner `uid = "op_01"` updating existing `/devices/dev_01`
   - Target: `UPDATE /devices/dev_01` changing `ownerId` or `createdAt`
9. **DD-09 Terminal State Reopen / Tamper Attack:**
   - Actor: Verified non-admin user `uid = "op_01"`
   - Target: `UPDATE /alerts/alt_closed_1` (where `existing().status == 'resuelta'`) trying to change `status: 'activa'` or `resolved: false`
10. **DD-10 Forged Client Timestamp (`createdAt` != `request.time`):**
    - Actor: Verified user `uid = "op_01"`
    - Target: `CREATE /devices/dev_time_spoof` with client-picked `createdAt = Timestamp(2020-01-01)`
11. **DD-11 Orphaned / Oversized Executable Attachment:**
    - Actor: Verified user `uid = "op_01"`
    - Target: `CREATE /attachments/att_evil` referencing non-existent `alertId: "missing_alert"` with `contentType: "application/x-msdownload"` or `sizeBytes: 99999999`
12. **DD-12 Negative Cost / Shadow Field Rental Tampering:**
    - Actor: Verified non-admin user `uid = "op_01"`
    - Target: `CREATE /rentals/ren_tamper` with `"monthlyCostClp": -5000`
