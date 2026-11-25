import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import type { SubjectId, UserAccount, UserRole } from '../types/exam';
import {
  confirmPasswordReset,
  loginWithCredentials,
  quickLoginDemoAccount,
  registerAccount,
  requestPasswordResetCode,
  setCurrentSessionUserId,
  type PasswordResetChallenge,
} from '../utils/authStore';
import { useSubjects } from '../utils/subjectStore';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface AuthScreenProps {
  initialMode?: 'login' | 'register';
  allowSelfRegistration?: boolean;
  allowGuestPreview?: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserAccount) => void;
  onContinueGuest: () => void;
}

export function AuthScreen({
  initialMode = 'login',
  allowSelfRegistration = true,
  allowGuestPreview = true,
  isDark,
  onToggleTheme,
  onAuthenticated,
  onContinueGuest,
}: AuthScreenProps) {
  useSubjects();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(
    initialMode === 'register' && allowSelfRegistration ? 'register' : 'login',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetChallenge, setResetChallenge] = useState<PasswordResetChallenge | null>(
    null,
  );
  const [resetOtpInput, setResetOtpInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);

  // Register form state
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [regSbd, setRegSbd] = useState('');
  const [regClass, setRegClass] = useState('12A1');
  const [regSchool, setRegSchool] = useState('THPT Chuyên Chu Văn An');
  const [regSubject, setRegSubject] = useState<SubjectId>('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const result = await loginWithCredentials(loginIdentifier, loginPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAuthenticated(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);

    if (regPassword !== regConfirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng nhập lại.');
      return;
    }
    if (regRole === 'teacher' && !regSubject.trim()) {
      setError('Vui lòng tìm kiếm và chọn Môn phụ trách chính.');
      return;
    }

    setLoading(true);
    try {
      const result = await registerAccount({
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        role: regRole,
        studentSbd: regRole === 'student' ? regSbd : undefined,
        studentClass: regRole === 'student' ? regClass : undefined,
        schoolName: regRole === 'teacher' ? regSchool : undefined,
        subject: regRole === 'teacher' ? regSubject : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCurrentSessionUserId(result.user.id);
      onAuthenticated(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      const user = await quickLoginDemoAccount(role);
      onAuthenticated(user);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgot = () => {
    setError(null);
    setSuccessNote(null);
    setForgotIdentifier(loginIdentifier);
    setResetChallenge(null);
    setResetOtpInput('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setMode('forgot');
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const res = await requestPasswordResetCode(forgotIdentifier);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResetChallenge(res.challenge);
      setResetOtpInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    if (resetNewPassword !== resetConfirmPassword) {
      setError('Mật khẩu mới xác nhận không khớp. Vui lòng nhập lại.');
      return;
    }
    setLoading(true);
    try {
      const res = await confirmPasswordReset(
        forgotIdentifier,
        resetOtpInput,
        resetNewPassword,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLoginIdentifier(res.user.email);
      setLoginPassword('');
      setResetChallenge(null);
      setMode('login');
      setSuccessNote(
        `Đã đặt lại mật khẩu thành công cho ${res.user.fullName} (${res.user.email}). Vui lòng đăng nhập bằng mật khẩu mới.`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              KỳThi 2025
            </span>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-slate-200 sm:inline-block dark:bg-slate-700"
            />
            <span className="hidden text-xs font-medium text-slate-500 sm:inline dark:text-slate-400">
              Cổng thi &amp; Tổ chức kiểm tra trực tuyến chuẩn Bộ GD&amp;ĐT 2025
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {allowGuestPreview && (
              <button
                type="button"
                onClick={onContinueGuest}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Xem thử không cần đăng nhập
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Container */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-12">
        {/* Left Editorial / Role Guide & Quick Demo */}
        <section className="space-y-6 lg:col-span-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              Xác thực tài khoản Học sinh &amp; Giáo viên
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance] dark:text-slate-50">
              Đăng nhập hệ thống thi trực tuyến KỳThi 2025
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Mỗi vai trò được cấp không gian làm việc riêng biệt: thí sinh dự thi và theo dõi
              phiếu điểm cá nhân; giáo viên tổ chức kỳ thi, quản lý ngân hàng câu hỏi và giám sát
              phòng thi.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tài khoản Học sinh
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Tự động điền Họ tên, Số báo danh và Lớp khi vào phòng thi. Xem quy chuẩn 2025 và
                  tra cứu kết quả bài làm.
                </p>
              </div>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex items-start gap-3">
              <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tài khoản Giáo viên
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Toàn quyền tạo đề thi từ Ma trận 2025, nhập file đề/đáp án (Word, Excel), quản lý
                  ngân hàng câu hỏi, nhận cảnh báo vi phạm &amp; cấp tài khoản mới.
                </p>
              </div>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Tài khoản Quản trị viên (Admin)
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Quản lý toàn bộ tài khoản, cấu hình tính năng hệ thống, theo dõi biểu đồ thống kê
                  và sao lưu dữ liệu toàn cổng thi.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Demo Accounts */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Đăng nhập nhanh bằng tài khoản mẫu
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dùng thử ngay không cần tạo mới (mật khẩu mặc định:{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                123456
              </span>
              )
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleQuickDemo('student')}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Học sinh mẫu · Nguyễn Minh Anh
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    hocsinh@kythi2025.edu.vn · SBD 0102588
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleQuickDemo('teacher')}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Giáo viên mẫu · ThS. Trần Quốc Bảo
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    giaovien@kythi2025.edu.vn · Tổ Toán
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleQuickDemo('admin')}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-amber-700 dark:hover:bg-amber-950/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Quản trị viên (Admin) · Toàn quyền hệ thống
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    admin@kythi2025.edu.vn · Quản lý User &amp; Thống kê
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              </button>
            </div>
          </div>
        </section>

        {/* Right Auth Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          {/* Segmented Tab Switcher */}
          <div
            role="tablist"
            aria-label="Chế độ xác thực"
            className={`grid gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 ${
              allowSelfRegistration ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessNote(null);
              }}
              className={`cursor-pointer whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Đăng nhập
            </button>
            {allowSelfRegistration && (
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessNote(null);
                }}
                className={`cursor-pointer whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Đăng ký tài khoản
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNote && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successNote}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="login-id"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email hoặc Số báo danh (SBD)
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="login-id"
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="VD: hocsinh@kythi2025.edu.vn hoặc 0102588"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="login-pw"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenForgot}
                    className="cursor-pointer text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="login-pw"
                    type={showLoginPw ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tài khoản"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                  <button
                    type="button"
                    aria-label={showLoginPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowLoginPw((v) => !v)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                  >
                    {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {allowSelfRegistration ? (
                <p className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  Chưa có tài khoản Học sinh hoặc Giáo viên?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    Đăng ký ngay
                  </button>
                </p>
              ) : (
                <p className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  Tính năng tự đăng ký tài khoản đang được Quản trị viên tạm khóa. Vui lòng liên hệ
                  Admin hoặc Giáo viên để được cấp tài khoản.
                </p>
              )}
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
              {/* Role Selector Cards */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chọn loại tài khoản muốn tạo
                </span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                      regRole === 'student'
                        ? 'border-blue-700 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/50'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-slate-600'
                    }`}
                  >
                    <GraduationCap
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        regRole === 'student'
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Học sinh
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Vào phòng thi &amp; tra cứu điểm
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole('teacher')}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                      regRole === 'teacher'
                        ? 'border-emerald-700 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/50'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-slate-600'
                    }`}
                  >
                    <ShieldCheck
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        regRole === 'teacher'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Giáo viên
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Tạo đề, coi thi &amp; chấm bài
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Họ và tên
                  </label>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder={
                        regRole === 'student' ? 'VD: Lê Hoàng Nam' : 'VD: Cô Nguyễn Thu Hà'
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email đăng nhập
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ten@truong.edu.vn"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                {regRole === 'student' ? (
                  <>
                    <div>
                      <label
                        htmlFor="reg-sbd"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Số báo danh (để trống để tự cấp)
                      </label>
                      <input
                        id="reg-sbd"
                        type="text"
                        value={regSbd}
                        onChange={(e) => setRegSbd(e.target.value.toUpperCase())}
                        placeholder="VD: 0102699"
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reg-class"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Lớp / Khối
                      </label>
                      <input
                        id="reg-class"
                        type="text"
                        required
                        value={regClass}
                        onChange={(e) => setRegClass(e.target.value.toUpperCase())}
                        placeholder="VD: 12A1"
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label
                        htmlFor="reg-school"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Trường / Đơn vị công tác
                      </label>
                      <input
                        id="reg-school"
                        type="text"
                        required
                        value={regSchool}
                        onChange={(e) => setRegSchool(e.target.value)}
                        placeholder="VD: THPT Chuyên Hà Nội"
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Môn phụ trách chính
                      </label>
                      <SubjectSearchSelect
                        value={regSubject}
                        onChange={(val) => {
                          setRegSubject(val);
                          if (error) setError(null);
                        }}
                        placeholder="Tìm tên môn phụ trách..."
                        ariaLabel="Tìm kiếm và chọn môn phụ trách chính"
                        className="mt-1.5"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="reg-pw"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu (tối thiểu 6 ký tự)
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="reg-pw"
                      type={showRegPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      aria-label={showRegPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onClick={() => setShowRegPw((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                    >
                      {showRegPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-pw2"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="reg-pw2"
                      type={showRegPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {loading
                    ? 'Đang tạo tài khoản...'
                    : regRole === 'student'
                      ? 'Đăng ký tài khoản Học sinh'
                      : 'Đăng ký tài khoản Giáo viên'}
                </span>
              </button>

              <p className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  Quay lại đăng nhập
                </button>
              </p>
            </form>
          ) : null}

          {mode === 'forgot' && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Khôi phục mật khẩu đăng nhập
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Xác minh tài khoản Học sinh hoặc Giáo viên để đặt lại mật khẩu mới
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>

              {!resetChallenge ? (
                <form onSubmit={handleRequestResetOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-id"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Email hoặc Số báo danh đã đăng ký
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        id="forgot-id"
                        type="text"
                        required
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="VD: hocsinh@kythi2025.edu.vn hoặc 0102588"
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:bg-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{loading ? 'Đang kiểm tra...' : 'Nhận mã xác nhận 6 số'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs dark:border-blue-900/70 dark:bg-blue-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {resetChallenge.fullName} (
                          {resetChallenge.role === 'admin'
                            ? 'Quản trị viên'
                            : resetChallenge.role === 'teacher'
                              ? 'Giáo viên'
                              : 'Học sinh'}
                          )
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          Email khôi phục: {resetChallenge.maskedEmail}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setResetChallenge(null);
                          setError(null);
                        }}
                        className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        Đổi tài khoản
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-blue-200/80 pt-2.5 dark:border-blue-800/70">
                      <span className="text-slate-700 dark:text-slate-300">
                        Mã xác nhận cục bộ (hiệu lực 5 phút):{' '}
                        <strong className="font-mono text-sm tracking-widest text-blue-700 tabular-nums dark:text-blue-300">
                          {resetChallenge.otpCode}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setResetOtpInput(resetChallenge.otpCode)}
                        className="cursor-pointer rounded-md border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
                      >
                        Điền nhanh mã
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reset-otp"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Nhập mã xác nhận 6 chữ số
                    </label>
                    <input
                      id="reset-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={resetOtpInput}
                      onChange={(e) =>
                        setResetOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="Nhập 6 chữ số"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 font-mono text-sm tracking-widest text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reset-pw"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Mật khẩu mới (≥ 6 ký tự)
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          id="reset-pw"
                          type={showResetPw ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="••••••"
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          aria-label={showResetPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          onClick={() => setShowResetPw((v) => !v)}
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                        >
                          {showResetPw ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reset-pw2"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          id="reset-pw2"
                          type={showResetPw ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="••••••"
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:bg-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{loading ? 'Đang cập nhật...' : 'Xác nhận đặt lại mật khẩu'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
