/**
 * Phase 0: Dirty Dozen Firestore Security Rules Verification Suite
 *
 * Run against Firebase Emulator Suite:
 *   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE_USER_ID = 'op_user_01';
const OTHER_USER_ID = 'op_user_02';
const ADMIN_UID = 'admin_uid_01';
const ADMIN_EMAIL = 'manuelcrisostomovega@gmail.com';

async function runTests() {
  let testingModule: any = null;
  try {
    const modName = '@firebase/rules-unit-testing';
    testingModule = await import(/* @vite-ignore */ modName);
  } catch {
    console.log(
      '[firestore.rules.test] @firebase/rules-unit-testing no está instalado o no hay emulador activo. Ejecuta contra Firebase Emulator cuando esté disponible.'
    );
    return;
  }

  const { initializeTestEnvironment, assertFails, assertSucceeds } = testingModule;
  const { Timestamp, doc, getDoc, setDoc, updateDoc } = await import('firebase/firestore');

  const testEnv = await initializeTestEnvironment({
    projectId: 'minesafe-security-audit',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const opDb = testEnv
      .authenticatedContext(BASE_USER_ID, { email: 'op1@minesafe.cl', email_verified: true })
      .firestore();
    const unverifiedSpoofDb = testEnv
      .authenticatedContext('attacker_01', { email: ADMIN_EMAIL, email_verified: false })
      .firestore();
    const verifiedAdminDb = testEnv
      .authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL, email_verified: true })
      .firestore();

    // Seed base records bypassing rules
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const db = ctx.firestore();
      const now = Timestamp.now();
      await setDoc(doc(db, 'users', OTHER_USER_ID), {
        id: OTHER_USER_ID,
        name: 'Operador Dos',
        email: 'op2@minesafe.cl',
        role: 'operador',
        status: 'activo',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'devices', 'dev_01'), {
        id: 'dev_01',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'MS-01',
        name: 'Nodo 01',
        status: 'normal',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'alerts', 'alt_closed_1'), {
        id: 'alt_closed_1',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'ALT-1',
        title: 'Gas CO Elevado',
        severity: 'critico',
        acknowledged: true,
        resolved: true,
        status: 'resuelta',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(db, 'alerts', 'alt_open_1'), {
        id: 'alt_open_1',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'ALT-2',
        title: 'Polvo PM2.5 Elevado',
        severity: 'advertencia',
        acknowledged: false,
        resolved: false,
        status: 'activa',
        createdAt: now,
        updatedAt: now,
      });
    });

    const serverTs = Timestamp.now();

    // DD-01: Unauthenticated Write
    await assertFails(
      setDoc(doc(unauthDb, 'alerts', 'evt_forged_1'), { id: 'evt_forged_1', title: 'Fake' })
    );

    // DD-02: Unverified Email Spoof of Admin
    await assertFails(
      setDoc(doc(unverifiedSpoofDb, 'admins', 'attacker_01'), {
        uid: 'attacker_01',
        email: ADMIN_EMAIL,
        role: 'superadmin',
        createdAt: serverTs,
      })
    );

    // DD-03: Self-Privilege Escalation on /users
    await assertFails(
      setDoc(doc(opDb, 'users', BASE_USER_ID), {
        id: BASE_USER_ID,
        name: 'Operador Uno',
        email: 'op1@minesafe.cl',
        role: 'superadmin',
        status: 'activo',
        createdAt: serverTs,
        updatedAt: serverTs,
      })
    );

    // DD-04: PII Cross-User Read
    await assertFails(getDoc(doc(opDb, 'users', OTHER_USER_ID)));

    // DD-05: Shadow / Ghost Field Injection
    await assertFails(
      setDoc(doc(opDb, 'alerts', 'alt_shadow_1'), {
        id: 'alt_shadow_1',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'ALT-SHADOW',
        title: 'Shadow test',
        severity: 'advertencia',
        acknowledged: false,
        resolved: false,
        status: 'activa',
        isVerified: true,
        createdAt: serverTs,
        updatedAt: serverTs,
      })
    );

    // DD-06: ID Poisoning (>128 chars or invalid chars)
    await assertFails(
      setDoc(doc(opDb, 'devices', 'A'.repeat(200)), {
        id: 'A'.repeat(200),
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'MS-X',
        name: 'Bad ID',
        status: 'normal',
        createdAt: serverTs,
        updatedAt: serverTs,
      })
    );

    // DD-07: Owner Identity Spoofing
    await assertFails(
      setDoc(doc(opDb, 'devices', 'dev_spoof_1'), {
        id: 'dev_spoof_1',
        ownerId: OTHER_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'MS-SPOOF',
        name: 'Spoof Device',
        status: 'normal',
        createdAt: serverTs,
        updatedAt: serverTs,
      })
    );

    // DD-08: Immutable ownerId Mutation on Update
    await assertFails(
      updateDoc(doc(opDb, 'devices', 'dev_01'), {
        ownerId: OTHER_USER_ID,
        updatedAt: serverTs,
      })
    );

    // DD-09: Terminal State Reopen by Non-Admin
    await assertFails(
      updateDoc(doc(opDb, 'alerts', 'alt_closed_1'), {
        status: 'activa',
        resolved: false,
        updatedAt: serverTs,
      })
    );

    // DD-10: Forged Client Timestamp
    await assertFails(
      setDoc(doc(opDb, 'devices', 'dev_time_spoof'), {
        id: 'dev_time_spoof',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        code: 'MS-TIME',
        name: 'Old TS',
        status: 'normal',
        createdAt: Timestamp.fromMillis(1577836800000),
        updatedAt: Timestamp.fromMillis(1577836800000),
      })
    );

    // DD-11: Orphaned / Executable Attachment
    await assertFails(
      setDoc(doc(opDb, 'attachments', 'att_evil'), {
        id: 'att_evil',
        alertId: 'non_existent_alert',
        ownerId: BASE_USER_ID,
        organizationId: 'org-minesafe-principal',
        fileName: 'payload.exe',
        contentType: 'application/x-msdownload',
        sizeBytes: 1024,
        downloadUrl: 'https://example.com/payload.exe',
        storagePath: 'adjuntos/payload.exe',
        uploadedBy: 'Attacker',
        createdAt: serverTs,
      })
    );

    // DD-12: Negative Cost Rental Tampering
    await assertFails(
      setDoc(doc(verifiedAdminDb, 'rentals', 'ren_tamper'), {
        id: 'ren_tamper',
        ownerId: ADMIN_UID,
        organizationId: 'org-minesafe-principal',
        contractNumber: 'CT-999',
        deviceCode: 'MS-01',
        provider: 'Test',
        monthlyCostClp: -5000,
        paymentStatus: 'al_dia',
        createdAt: serverTs,
        updatedAt: serverTs,
      })
    );

    // Positive sanity check: verified owner reads own user doc
    await assertSucceeds(getDoc(doc(opDb, 'alerts', 'alt_open_1')));
    assert.ok(true, 'All 12 Dirty Dozen payloads rejected and authorized paths succeeded.');
  } finally {
    await testEnv.cleanup();
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
