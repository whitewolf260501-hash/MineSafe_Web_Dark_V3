import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAppUrl,
  parseAppRoute,
  shouldUseHashRouting,
} from '../src/utils/navigation';
import {
  buildContactMailtoHref,
  validateContactForm,
} from '../src/utils/contactValidation';
import {
  belongsToOrganization,
  canModifyTargetUser,
  canProvisionUserInOrganization,
  filterScopedUsers,
  resolveEffectiveOrgId,
} from '../src/utils/accessControl';
import { UserProfile } from '../src/types';

function makeUser(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: 'usr-default',
    name: 'Usuario Test',
    email: 'usuario@empresa.cl',
    role: 'operador',
    roleLabel: 'Operador',
    rut: '11.111.111-1',
    shift: 'Turno A',
    status: 'activo',
    organizationId: 'org-alpha',
    ...overrides,
  };
}

console.log('Running MineSafe P013 Landing, Routing & Access Control Tests...\n');

// -----------------------------------------------------------------------------
// 1. Routing & Hash Parsing Tests
// -----------------------------------------------------------------------------
assert.deepEqual(parseAppRoute('/', ''), { route: 'landing' }, 'Root path resolves to landing');
assert.deepEqual(parseAppRoute('/index.html', ''), { route: 'landing' }, 'index.html resolves to landing');
assert.deepEqual(parseAppRoute('/acceso', ''), { route: 'login' }, '/acceso resolves to login');
assert.deepEqual(parseAppRoute('/panel', ''), { route: 'panel' }, '/panel resolves to panel');
assert.deepEqual(parseAppRoute('/', '#producto'), { route: 'landing', sectionId: 'producto' }, 'Landing section hash keeps landing route');
assert.deepEqual(parseAppRoute('/', '#contacto'), { route: 'landing', sectionId: 'contacto' }, 'Contacto section hash keeps landing route');
assert.deepEqual(parseAppRoute('/MineSafe_Web_Dark_V3/', '#/acceso'), { route: 'login' }, 'Hash route #/acceso resolves to login on subpath deploy');
assert.deepEqual(parseAppRoute('/MineSafe_Web_Dark_V3/', '#/panel'), { route: 'panel' }, 'Hash route #/panel resolves to panel on subpath deploy');
assert.deepEqual(parseAppRoute('/acceso', '#/panel'), { route: 'panel' }, 'Explicit hash route overrides stale pathname');

assert.equal(shouldUseHashRouting('/', ''), false, 'Root-hosted SPA uses clean history routing');
assert.equal(shouldUseHashRouting('/acceso', ''), false, '/acceso uses clean history routing');
assert.equal(shouldUseHashRouting('/panel', ''), false, '/panel uses clean history routing');
assert.equal(shouldUseHashRouting('/MineSafe_Web_Dark_V3/', ''), true, 'Nested subpath deploy uses hash routing');
assert.equal(shouldUseHashRouting('/', '#/acceso'), true, 'Explicit hash route preserves hash routing');

assert.equal(buildAppUrl('landing', { useHash: false }), '/', 'Clean landing URL');
assert.equal(buildAppUrl('login', { useHash: false }), '/acceso', 'Clean login URL');
assert.equal(buildAppUrl('panel', { useHash: false }), '/panel', 'Clean panel URL');
assert.equal(buildAppUrl('landing', { useHash: false, sectionId: 'contacto' }), '/#contacto', 'Landing anchor URL');
assert.equal(buildAppUrl('login', { useHash: true }), '#/acceso', 'Hash login URL');
assert.equal(buildAppUrl('panel', { useHash: true }), '#/panel', 'Hash panel URL');
console.log('✅ 1. Routing & subpath hash resolution passed');

// -----------------------------------------------------------------------------
// 2. Contact Form Validation & Anti-Abuse Tests
// -----------------------------------------------------------------------------
const emptyResult = validateContactForm(
  { name: '', organization: '', email: 'mal-correo', message: 'Hola', website: '' },
  0,
  100_000,
);
assert.equal(emptyResult.valid, false, 'Invalid contact payload is rejected');
assert.ok(emptyResult.errors.name, 'Requires name');
assert.ok(emptyResult.errors.organization, 'Requires organization');
assert.ok(emptyResult.errors.email, 'Rejects malformed email');
assert.ok(emptyResult.errors.message, 'Rejects overly short message');

const honeypotResult = validateContactForm(
  {
    name: 'Bot Test',
    organization: 'Spam SA',
    email: 'bot@spam.cl',
    message: 'Mensaje suficientemente largo para pasar longitud.',
    website: 'https://spam.example.com',
  },
  0,
  100_000,
);
assert.equal(honeypotResult.valid, false, 'Honeypot catches automated bots');
assert.ok(honeypotResult.errors.form, 'Honeypot produces form-level error');

const cooldownResult = validateContactForm(
  {
    name: 'Camila Rojas',
    organization: 'Pirquén Norte',
    email: 'camila@pirquen.cl',
    message: 'Solicitamos información del prototipo para evaluación en faena.',
    website: '',
  },
  90_000,
  100_000,
);
assert.equal(cooldownResult.valid, false, 'Cooldown blocks rapid repeated submissions');

const validContact = validateContactForm(
  {
    name: 'Camila Rojas',
    organization: 'Pirquén Norte',
    email: 'camila@pirquen.cl',
    message: 'Solicitamos información del prototipo para evaluación en faena.',
    website: '',
  },
  0,
  100_000,
);
assert.equal(validContact.valid, true, 'Valid contact payload passes validation');
const mailto = buildContactMailtoHref('contacto@ejemplo-real.cl', {
  name: 'Camila Rojas',
  organization: 'Pirquén Norte',
  email: 'camila@pirquen.cl',
  message: 'Solicitamos información del prototipo.',
  website: '',
});
assert.ok(mailto.startsWith('mailto:contacto@ejemplo-real.cl?'), 'Builds real mailto URI');
assert.ok(mailto.includes('Pirqu%C3%A9n%20Norte'), 'Encodes organization safely in mailto');
console.log('✅ 2. Contact form validation, honeypot, cooldown & mailto encoding passed');

// -----------------------------------------------------------------------------
// 3. RBAC & Multi-Organization Isolation Tests
// -----------------------------------------------------------------------------
const superadmin = makeUser({ id: 'sa-1', role: 'superadmin', organizationId: 'org-alpha' });
const adminAlpha = makeUser({ id: 'adm-a', role: 'admin', organizationId: 'org-alpha' });
const adminBeta = makeUser({ id: 'adm-b', role: 'admin', organizationId: 'org-beta' });
const opAlpha = makeUser({ id: 'op-a', role: 'operador', organizationId: 'org-alpha' });
const opBeta = makeUser({ id: 'op-b', role: 'operador', organizationId: 'org-beta' });
const inactiveAdmin = makeUser({ id: 'adm-off', role: 'admin', status: 'inactivo', organizationId: 'org-alpha' });

assert.equal(resolveEffectiveOrgId(adminAlpha, 'org-beta'), 'org-alpha', 'Admin cannot switch scope to another org');
assert.equal(resolveEffectiveOrgId(superadmin, 'org-beta'), 'org-beta', 'SuperAdmin can scope to target org');
assert.equal(belongsToOrganization('org-alpha', 'org-alpha'), true);
assert.equal(belongsToOrganization('org-beta', 'org-alpha'), false);

assert.equal(canProvisionUserInOrganization(opAlpha, 'org-alpha', 'operador').allowed, false, 'Operador cannot provision users');
assert.equal(canProvisionUserInOrganization(inactiveAdmin, 'org-alpha', 'operador').allowed, false, 'Inactive user cannot provision users');
assert.equal(canProvisionUserInOrganization(adminAlpha, 'org-beta', 'operador').allowed, false, 'Admin cannot provision user into another org');
assert.equal(canProvisionUserInOrganization(adminAlpha, 'org-alpha', 'superadmin').allowed, false, 'Admin cannot create superadmin');
assert.equal(canProvisionUserInOrganization(adminAlpha, 'org-alpha', 'admin').allowed, true, 'Admin can create admin inside own org');
assert.equal(canProvisionUserInOrganization(superadmin, 'org-beta', 'operador').allowed, true, 'SuperAdmin can create non-superadmin users across orgs');

assert.equal(canModifyTargetUser(adminAlpha, opBeta).allowed, false, 'Admin Alpha cannot modify Operador Beta');
assert.equal(canModifyTargetUser(adminAlpha, adminBeta).allowed, false, 'Admin Alpha cannot modify Admin Beta');
assert.equal(canModifyTargetUser(adminAlpha, superadmin).allowed, false, 'Admin Alpha cannot modify SuperAdmin');
assert.equal(canModifyTargetUser(adminAlpha, opAlpha).allowed, true, 'Admin Alpha can modify Operador Alpha');
assert.equal(canModifyTargetUser(superadmin, opBeta).allowed, true, 'SuperAdmin can modify Operador Beta');

const allUsers = [superadmin, adminAlpha, adminBeta, opAlpha, opBeta];
const alphaScoped = filterScopedUsers(allUsers, adminAlpha, 'org-beta');
assert.deepEqual(
  alphaScoped.map((u) => u.id),
  ['adm-a', 'op-a'],
  'Admin Alpha only sees users from org-alpha',
);
console.log('✅ 3. RBAC & multi-organization isolation guards passed');

// -----------------------------------------------------------------------------
// 4. Static Security & Separation Invariants (P013 Compliance)
// -----------------------------------------------------------------------------
const rootDir = process.cwd();
const readSrc = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

const mainSrc = readSrc('src/main.tsx');
const rootAppSrc = readSrc('src/RootApp.tsx');
const landingSrc = readSrc('src/components/PublicLanding.tsx');
const loginViewSrc = readSrc('src/components/LoginView.tsx');
const loginModalSrc = readSrc('src/components/LoginModal.tsx');
const firebaseSrc = readSrc('src/services/firebase.ts');
const rtdbRulesSrc = readSrc('database.rules.json');
const firestoreRulesSrc = readSrc('firestore.rules');

assert.ok(mainSrc.includes('RootApp'), 'main.tsx boots RootApp rather than directly booting App');
assert.ok(rootAppSrc.includes("lazy(() => import('./App')"), 'RootApp lazy-loads private panel only after session check');
assert.ok(rootAppSrc.includes("user.status === 'activo' ? user : null"), 'RootApp rejects inactive accounts at auth root');
assert.ok(rootAppSrc.includes("routeState.route === 'login' || !currentUser"), 'RootApp prevents private panel mount without verified session');

assert.ok(!landingSrc.includes('firebase'), 'PublicLanding has zero Firebase imports/calls');
assert.ok(!landingSrc.includes('mockData'), 'PublicLanding has zero internal mockData imports');
assert.ok(!landingSrc.includes('manuelcrisostomovega@gmail.com'), 'PublicLanding leaks no internal personal emails');
assert.ok(!landingSrc.includes('192.168.'), 'PublicLanding exposes no internal IP addresses');

assert.ok(!loginViewSrc.includes('registerWithFirebaseAuth'), 'LoginView exposes no public registration handler');
assert.ok(!loginViewSrc.includes('PRELOADED_USERS'), 'LoginView leaks no preloaded profile cards');
assert.ok(!loginModalSrc.includes('registerWithFirebaseAuth'), 'LoginModal exposes no public registration tab');
assert.ok(!loginModalSrc.includes('PRELOADED_USERS'), 'LoginModal leaks no quick-switch hardcoded user cards');
assert.ok(!fs.existsSync(path.join(rootDir, 'src/components/UserManagementModal.tsx')), 'Legacy insecure UserManagementModal removed');

assert.ok(firebaseSrc.includes('auth/public-registration-disabled'), 'firebase.ts explicitly disables public self-registration');
assert.ok(firebaseSrc.includes('auth/unauthorized-profile'), 'firebase.ts rejects Firebase Auth logins without authorized active /usuarios profile');
assert.ok(rtdbRulesSrc.includes("/isActive').val() !== false"), 'database.rules.json blocks inactive accounts from RTDB access');
assert.ok(!firestoreRulesSrc.includes("incoming().role == 'operador'"), 'firestore.rules disallows client self-registration on /users');

console.log('✅ 4. Static P013 separation, no-self-registration & privacy invariants passed');
console.log('\n🎉 All P013 checks passed!');
