import type { SubjectId, UserAccount, UserRole } from '../types/exam';
import { appendSystemLog } from './systemLogs';

const ACCOUNTS_STORAGE_KEY = 'kythi2025_accounts_v1';
const SESSION_STORAGE_KEY = 'kythi2025_active_session_v1';

interface StoredUserRecord extends UserAccount {
  salt: string;
  passwordHash: string;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  studentSbd?: string;
  studentClass?: string;
  schoolName?: string;
  subject?: SubjectId;
}

export type AuthActionResult =
  | { ok: true; user: UserAccount }
  | { ok: false; error: string };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return toHex(buf);
  }
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return toHex(new Uint8Array(digest));
  }
  // Fallback deterministic hash only if WebCrypto subtle is unavailable
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

function sanitizeAccount(record: StoredUserRecord): UserAccount {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    studentSbd: record.studentSbd,
    studentClass: record.studentClass,
    schoolName: record.schoolName,
    subject: record.subject,
    avatarUrl: record.avatarUrl,
    facebookUrl: record.facebookUrl,
    enrolledClassIds: Array.isArray(record.enrolledClassIds)
      ? record.enrolledClassIds
      : undefined,
    createdAt: record.createdAt,
  };
}

// Precomputed deterministic seed salt + hash helper built lazily on first read
async function buildSeedRecords(): Promise<StoredUserRecord[]> {
  const studentSalt = 'kythi2025_seed_stu_01';
  const teacherSalt = 'kythi2025_seed_tch_01';
  const adminSalt = 'kythi2025_seed_adm_01';
  const [studentHash, teacherHash, adminHash] = await Promise.all([
    hashPassword('123456', studentSalt),
    hashPassword('123456', teacherSalt),
    hashPassword('123456', adminSalt),
  ]);

  return [
    {
      id: 'acc_seed_admin_1',
      email: 'admin@kythi2025.edu.vn',
      fullName: 'Quản trị viên Hệ thống',
      role: 'admin',
      schoolName: 'Ban Quản trị KỳThi 2025',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: adminSalt,
      passwordHash: adminHash,
    },
    {
      id: 'acc_seed_student_1',
      email: 'hocsinh@kythi2025.edu.vn',
      fullName: 'Nguyễn Minh Anh',
      role: 'student',
      studentSbd: '0102588',
      studentClass: '12A1',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: studentSalt,
      passwordHash: studentHash,
    },
    {
      id: 'acc_seed_teacher_1',
      email: 'giaovien@kythi2025.edu.vn',
      fullName: 'ThS. Trần Quốc Bảo',
      role: 'teacher',
      schoolName: 'THPT Chuyên Chu Văn An',
      subject: 'toan',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: teacherSalt,
      passwordHash: teacherHash,
    },
  ];
}

function readRawRecordsSync(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUserRecord[]) : [];
  } catch {
    return [];
  }
}

function saveRawRecordsSync(records: StoredUserRecord[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

export async function ensureSeedAccounts(): Promise<UserAccount[]> {
  const existing = readRawRecordsSync();
  if (existing.length > 0) {
    // Upgrade existing storage seamlessly if admin seed account does not yet exist
    const hasAdmin = existing.some(
      (r) => r.role === 'admin' || r.email.toLowerCase() === 'admin@kythi2025.edu.vn',
    );
    if (!hasAdmin) {
      const seeds = await buildSeedRecords();
      const adminSeed = seeds.find((s) => s.role === 'admin');
      if (adminSeed) {
        const merged = [adminSeed, ...existing];
        saveRawRecordsSync(merged);
        return merged.map(sanitizeAccount);
      }
    }
    return existing.map(sanitizeAccount);
  }
  const seeds = await buildSeedRecords();
  saveRawRecordsSync(seeds);
  return seeds.map(sanitizeAccount);
}

export async function resetSeedAccounts(): Promise<UserAccount[]> {
  const seeds = await buildSeedRecords();
  saveRawRecordsSync(seeds);
  return seeds.map(sanitizeAccount);
}

export function listAccountsSync(): UserAccount[] {
  return readRawRecordsSync().map(sanitizeAccount);
}

export function getCurrentSessionUser(): UserAccount | null {
  try {
    const activeId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!activeId) return null;
    const records = readRawRecordsSync();
    const matched = records.find((r) => r.id === activeId);
    return matched ? sanitizeAccount(matched) : null;
  } catch {
    return null;
  }
}

export function setCurrentSessionUserId(accountId: string | null): void {
  try {
    if (!accountId) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, accountId);
    }
  } catch {
    // Ignore storage errors
  }
}

function generateAutoSbd(existing: StoredUserRecord[]): string {
  const used = new Set(
    existing.map((r) => (r.studentSbd ?? '').trim().toUpperCase()).filter(Boolean),
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `010${Math.floor(1000 + Math.random() * 8999)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `010${Date.now().toString().slice(-4)}`;
}

export async function registerAccount(
  input: RegisterAccountInput,
): Promise<AuthActionResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();

  const cleanName = input.fullName.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanPassword = input.password;

  if (cleanName.length < 2) {
    return { ok: false, error: 'Họ và tên cần có ít nhất 2 ký tự.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Địa chỉ email không hợp lệ (VD: ten@truong.edu.vn).' };
  }
  if (cleanPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
  }

  if (records.some((r) => r.email.toLowerCase() === cleanEmail)) {
    return {
      ok: false,
      error: 'Email này đã được đăng ký. Vui lòng chọn email khác hoặc đăng nhập.',
    };
  }

  let studentSbd: string | undefined;
  let studentClass: string | undefined;
  let schoolName: string | undefined;
  let subject: SubjectId | undefined;

  if (input.role === 'student') {
    const requestedSbd = (input.studentSbd ?? '').trim().toUpperCase();
    if (requestedSbd) {
      if (records.some((r) => r.studentSbd?.toUpperCase() === requestedSbd)) {
        return {
          ok: false,
          error: `Số báo danh "${requestedSbd}" đã thuộc về một tài khoản học sinh khác.`,
        };
      }
      studentSbd = requestedSbd;
    } else {
      studentSbd = generateAutoSbd(records);
    }
    studentClass = (input.studentClass ?? '').trim().toUpperCase() || '12A1';
  } else if (input.role === 'teacher') {
    schoolName = (input.schoolName ?? '').trim() || 'THPT Công lập';
    subject = input.subject ?? 'toan';
  } else {
    schoolName = (input.schoolName ?? '').trim() || 'Ban Quản trị Hệ thống';
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(cleanPassword, salt);

  const newRecord: StoredUserRecord = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: cleanEmail,
    fullName: cleanName,
    role: input.role,
    studentSbd,
    studentClass,
    schoolName,
    subject,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash,
  };

  saveRawRecordsSync([newRecord, ...records]);
  const createdUser = sanitizeAccount(newRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng ký tài khoản mới',
    detail: `Tạo tài khoản ${createdUser.role} "${createdUser.fullName}" (${createdUser.email}).`,
    actorName: createdUser.fullName,
    actorRole: createdUser.role,
    actorId: createdUser.id,
    targetLabel: createdUser.email,
  });
  return { ok: true, user: createdUser };
}

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<AuthActionResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();

  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) {
    return { ok: false, error: 'Vui lòng nhập đầy đủ Email (hoặc SBD) và Mật khẩu.' };
  }

  const found = records.find(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (!found) {
    appendSystemLog({
      category: 'auth',
      level: 'warning',
      action: 'Đăng nhập thất bại (Không tìm thấy tài khoản)',
      detail: `Thử đăng nhập với định danh "${identifier.trim()}".`,
      actorName: identifier.trim() || 'Khách',
      actorRole: 'guest',
      targetLabel: cleanId,
    });
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản với Email hoặc Số báo danh này.',
    };
  }

  const candidateHash = await hashPassword(password, found.salt);
  if (candidateHash !== found.passwordHash) {
    appendSystemLog({
      category: 'auth',
      level: 'warning',
      action: 'Đăng nhập thất bại (Sai mật khẩu)',
      detail: `Nhập sai mật khẩu cho tài khoản ${found.fullName} (${found.email}).`,
      actorName: found.fullName,
      actorRole: found.role,
      actorId: found.id,
      targetLabel: found.email,
    });
    return { ok: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại.' };
  }

  const sanitized = sanitizeAccount(found);
  setCurrentSessionUserId(sanitized.id);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng nhập hệ thống',
    detail: `${sanitized.fullName} (${sanitized.email}) đã đăng nhập thành công.`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export async function quickLoginDemoAccount(role: UserRole): Promise<UserAccount> {
  await ensureSeedAccounts();
  let records = readRawRecordsSync();
  let target = records.find((r) => r.role === role);
  if (!target) {
    await resetSeedAccounts();
    records = readRawRecordsSync();
    target = records.find((r) => r.role === role) ?? records[0];
  }
  const sanitized = sanitizeAccount(target);
  setCurrentSessionUserId(sanitized.id);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng nhập nhanh tài khoản mẫu',
    detail: `Đăng nhập nhanh vai trò ${role}: ${sanitized.fullName} (${sanitized.email}).`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return sanitized;
}

export function switchSessionAccount(accountId: string): UserAccount | null {
  const records = readRawRecordsSync();
  const found = records.find((r) => r.id === accountId);
  if (!found) return null;
  setCurrentSessionUserId(found.id);
  const sanitized = sanitizeAccount(found);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Chuyển đổi phiên tài khoản',
    detail: `Chuyển phiên hoạt động sang ${sanitized.fullName} (${sanitized.email}).`,
    targetLabel: sanitized.email,
  });
  return sanitized;
}

export function deleteStoredAccount(accountId: string): UserAccount[] {
  const records = readRawRecordsSync();
  const removed = records.find((r) => r.id === accountId);
  const next = records.filter((r) => r.id !== accountId);
  saveRawRecordsSync(next);
  if (localStorage.getItem(SESSION_STORAGE_KEY) === accountId) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  if (removed) {
    appendSystemLog({
      category: 'user',
      level: 'warning',
      action: 'Xóa tài khoản người dùng',
      detail: `Đã xóa tài khoản ${removed.fullName} (${removed.email} · ${removed.role}).`,
      targetLabel: removed.email,
    });
  }
  return next.map(sanitizeAccount);
}

const RESET_OTP_STORAGE_KEY = 'kythi2025_reset_otp_v1';

interface StoredResetOtp {
  userId: string;
  otpCode: string;
  expiresAt: number;
}

export interface PasswordResetChallenge {
  userId: string;
  fullName: string;
  maskedEmail: string;
  role: UserRole;
  otpCode: string;
  expiresAt: number;
}

export type PasswordResetRequestResult =
  | { ok: true; challenge: PasswordResetChallenge }
  | { ok: false; error: string };

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(5, local.length - 2))}@${domain}`;
}

function generateSixDigitOtp(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(100000 + (arr[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestPasswordResetCode(
  identifier: string,
): Promise<PasswordResetRequestResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();
  const cleanId = identifier.trim().toLowerCase();

  if (!cleanId) {
    return {
      ok: false,
      error: 'Vui lòng nhập Email hoặc Số báo danh cần khôi phục mật khẩu.',
    };
  }

  const found = records.find(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (!found) {
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản khớp với Email hoặc Số báo danh này.',
    };
  }

  const otpCode = generateSixDigitOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  try {
    const payload: StoredResetOtp = {
      userId: found.id,
      otpCode,
      expiresAt,
    };
    sessionStorage.setItem(RESET_OTP_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage errors
  }

  return {
    ok: true,
    challenge: {
      userId: found.id,
      fullName: found.fullName,
      maskedEmail: maskEmailAddress(found.email),
      role: found.role,
      otpCode,
      expiresAt,
    },
  };
}

export async function confirmPasswordReset(
  identifier: string,
  otpCode: string,
  newPassword: string,
): Promise<AuthActionResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();
  const cleanId = identifier.trim().toLowerCase();
  const cleanOtp = otpCode.trim();

  const foundIdx = records.findIndex(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (foundIdx === -1) {
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản cần đặt lại mật khẩu.',
    };
  }

  let storedOtp: StoredResetOtp | null = null;
  try {
    const raw = sessionStorage.getItem(RESET_OTP_STORAGE_KEY);
    if (raw) storedOtp = JSON.parse(raw) as StoredResetOtp;
  } catch {
    storedOtp = null;
  }

  const target = records[foundIdx];
  if (!storedOtp || storedOtp.userId !== target.id) {
    return {
      ok: false,
      error: 'Chưa có yêu cầu đặt lại mật khẩu hợp lệ. Vui lòng gửi lại mã xác nhận.',
    };
  }

  if (Date.now() > storedOtp.expiresAt) {
    return {
      ok: false,
      error: 'Mã xác nhận đã hết hạn (quá 5 phút). Vui lòng lấy mã mới.',
    };
  }

  if (cleanOtp !== storedOtp.otpCode) {
    return {
      ok: false,
      error: 'Mã xác nhận 6 số không chính xác. Vui lòng kiểm tra lại.',
    };
  }

  if (newPassword.length < 6) {
    return {
      ok: false,
      error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
    };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...target,
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[foundIdx] = updatedRecord;
  saveRawRecordsSync(nextRecords);

  try {
    sessionStorage.removeItem(RESET_OTP_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup error
  }

  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Khôi phục mật khẩu qua mã xác nhận',
    detail: `Đặt lại mật khẩu thành công cho ${sanitized.fullName} (${sanitized.email}).`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });

  return { ok: true, user: sanitized };
}

export async function resetAccountPasswordDirect(
  accountId: string,
  newPassword: string,
): Promise<AuthActionResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...records[idx],
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updatedRecord;
  saveRawRecordsSync(nextRecords);
  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'warning',
    action: 'Quản trị viên cấp lại mật khẩu',
    detail: `Cấp lại mật khẩu trực tiếp cho tài khoản ${sanitized.fullName} (${sanitized.email}).`,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export function normalizeFacebookProfileUrl(
  raw: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Liên kết Facebook phải sử dụng giao thức http:// hoặc https://.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    const isFbHost =
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com') ||
      host === 'fb.me';
    if (!isFbHost) {
      return {
        ok: false,
        error:
          'Vui lòng nhập liên kết tài khoản Facebook hợp lệ (VD: https://www.facebook.com/ten.tai.khoan).',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error:
        'Liên kết Facebook không đúng định dạng URL (VD: https://www.facebook.com/ten.tai.khoan).',
    };
  }
}

export function normalizeSafeAvatarUrl(
  raw: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return { ok: true, value: trimmed };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Ảnh đại diện URL phải sử dụng http://, https:// hoặc tải ảnh từ máy.',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: 'Đường dẫn ảnh đại diện không hợp lệ.',
    };
  }
}

export async function changeAccountPassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthActionResult> {
  if (!currentPassword) {
    return { ok: false, error: 'Vui lòng nhập mật khẩu hiện tại để xác thực.' };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' };
  }

  const target = records[idx];
  const currentHash = await hashPassword(currentPassword, target.salt);
  if (currentHash !== target.passwordHash) {
    return { ok: false, error: 'Mật khẩu hiện tại không chính xác.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...target,
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updatedRecord;
  saveRawRecordsSync(nextRecords);
  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đổi mật khẩu tài khoản',
    detail: `${sanitized.fullName} (${sanitized.email}) đã thay đổi mật khẩu đăng nhập.`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export function updateStoredAccount(
  accountId: string,
  patch: {
    fullName?: string;
    role?: UserRole;
    studentSbd?: string;
    studentClass?: string;
    schoolName?: string;
    subject?: SubjectId;
    avatarUrl?: string;
    facebookUrl?: string;
    enrolledClassIds?: string[];
  },
): AuthActionResult {
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản cần cập nhật.' };
  }

  const current = records[idx];
  const nextName = (patch.fullName ?? current.fullName).trim();
  if (nextName.length < 2) {
    return { ok: false, error: 'Họ và tên phải có tối thiểu 2 ký tự.' };
  }

  let nextAvatarUrl = current.avatarUrl;
  if (patch.avatarUrl !== undefined) {
    const avatarCheck = normalizeSafeAvatarUrl(patch.avatarUrl);
    if (!avatarCheck.ok) {
      return { ok: false, error: avatarCheck.error };
    }
    nextAvatarUrl = avatarCheck.value;
  }

  let nextFacebookUrl = current.facebookUrl;
  if (patch.facebookUrl !== undefined) {
    const fbCheck = normalizeFacebookProfileUrl(patch.facebookUrl);
    if (!fbCheck.ok) {
      return { ok: false, error: fbCheck.error };
    }
    nextFacebookUrl = fbCheck.value;
  }

  const nextEnrolledClassIds =
    patch.enrolledClassIds !== undefined
      ? Array.from(new Set(patch.enrolledClassIds.filter(Boolean)))
      : current.enrolledClassIds;

  const nextRole = patch.role ?? current.role;
  let nextSbd = current.studentSbd;
  let nextClass = current.studentClass;
  let nextSchool = current.schoolName;
  let nextSubject = current.subject;

  if (nextRole === 'student') {
    const candidateSbd = (patch.studentSbd ?? current.studentSbd ?? '').trim().toUpperCase();
    if (
      candidateSbd &&
      records.some(
        (r) => r.id !== accountId && r.studentSbd?.toUpperCase() === candidateSbd,
      )
    ) {
      return {
        ok: false,
        error: `Số báo danh "${candidateSbd}" đã được gán cho tài khoản khác.`,
      };
    }
    nextSbd = candidateSbd || generateAutoSbd(records);
    nextClass = (patch.studentClass ?? current.studentClass ?? '12A1').trim().toUpperCase();
    nextSchool = undefined;
    nextSubject = undefined;
  } else if (nextRole === 'teacher') {
    nextSchool = (patch.schoolName ?? current.schoolName ?? 'THPT Công lập').trim();
    nextSubject = patch.subject ?? current.subject ?? 'toan';
    nextSbd = undefined;
    nextClass = undefined;
  } else {
    nextSchool = (patch.schoolName ?? current.schoolName ?? 'Ban Quản trị KỳThi 2025').trim();
    nextSbd = undefined;
    nextClass = undefined;
    nextSubject = undefined;
  }

  const updated: StoredUserRecord = {
    ...current,
    fullName: nextName,
    role: nextRole,
    studentSbd: nextSbd,
    studentClass: nextClass,
    schoolName: nextSchool,
    subject: nextSubject,
    avatarUrl: nextAvatarUrl,
    facebookUrl: nextFacebookUrl,
    enrolledClassIds: nextEnrolledClassIds,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updated;
  saveRawRecordsSync(nextRecords);
  const sanitized = sanitizeAccount(updated);

  const onlyEnrollmentChanged =
    patch.enrolledClassIds !== undefined &&
    patch.fullName === undefined &&
    patch.role === undefined &&
    patch.studentSbd === undefined &&
    patch.studentClass === undefined &&
    patch.schoolName === undefined &&
    patch.subject === undefined &&
    patch.avatarUrl === undefined &&
    patch.facebookUrl === undefined;

  if (!onlyEnrollmentChanged) {
    appendSystemLog({
      category: 'user',
      level: 'info',
      action: 'Cập nhật hồ sơ & phân quyền tài khoản',
      detail: `Cập nhật thông tin tài khoản ${sanitized.fullName} (${sanitized.email} · ${sanitized.role}).`,
      targetLabel: sanitized.email,
    });
  }

  return { ok: true, user: sanitized };
}

export function exportAccountsToCsv(accounts: UserAccount[]): void {
  const esc = (v: string | number | undefined) => {
    const str = String(v ?? '');
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = ['ID', 'Họ và tên', 'Email', 'Vai trò', 'SBD', 'Lớp', 'Đơn vị / Trường', 'Môn', 'Ngày tạo'];
  const rows = accounts.map((a) => [
    esc(a.id),
    esc(a.fullName),
    esc(a.email),
    esc(a.role === 'admin' ? 'Admin' : a.role === 'teacher' ? 'Giáo viên' : 'Học sinh'),
    esc(a.studentSbd ?? ''),
    esc(a.studentClass ?? ''),
    esc(a.schoolName ?? ''),
    esc(a.subject ?? ''),
    esc(a.createdAt),
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tai_khoan_kythi2025_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


