import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountManagerModal } from './components/AccountManagerModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { ExamLobbyModal } from './components/ExamLobbyModal';
import { ExamManager } from './components/ExamManager';
import { ExamResultView } from './components/ExamResultView';
import { ExamRoom } from './components/ExamRoom';
import { Header, type AppView } from './components/Header';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PortalOverview } from './components/PortalOverview';
import { PrintableExamModal } from './components/PrintableExamModal';
import { QuestionBankManager } from './components/QuestionBankManager';
import { ResultsLedger } from './components/ResultsLedger';
import { RightSidebar } from './components/RightSidebar';
import type { StudentHomeSectionId } from './components/StudentHomeDashboard';
import { TeacherAlertToastStack } from './components/TeacherNotificationCenter';
import { UserProfileModal } from './components/UserProfileModal';
import { useExamStore } from './hooks/useExamStore';
import { useTheme } from './hooks/useTheme';
import type {
  Exam,
  ExamSubmission,
  ExamVariant,
  SystemLogEntry,
  TeacherAlert,
  UserAccount,
} from './types/exam';
import {
  appendSystemLog,
  clearSystemLogs,
  readSystemLogs,
  resetSeedSystemLogs,
  subscribeSystemLogs,
} from './utils/systemLogs';
import {
  ensureSeedAccounts,
  getCurrentSessionUser,
  resetSeedAccounts,
  setCurrentSessionUserId,
} from './utils/authStore';
import {
  canUserViewExam,
  canUserViewSubmission,
  generateExamVariant,
  isTeacherPrivateClassOwner,
} from './utils/scoring2025';
import {
  clearAllTeacherAlerts,
  markAllTeacherAlertsRead,
  markTeacherAlertRead,
  pushTeacherAlert,
  readTeacherAlerts,
  resetSeedTeacherAlerts,
  subscribeTeacherAlerts,
} from './utils/teacherAlerts';

const TEACHER_ALERT_SOUND_KEY = 'kythi2025_teacher_alert_sound_v1';
const RIGHT_SIDEBAR_COLLAPSED_KEY = 'kythi2025_right_sidebar_collapsed_v1';
const GUEST_SUBMISSION_IDS_KEY = 'kythi2025_guest_sub_ids_v1';

interface ActiveSession {
  exam: Exam;
  variant: ExamVariant;
  candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
  };
}

export default function App() {
  const {
    questions,
    questionMap,
    exams,
    privateClasses,
    classJoinRequests,
    classMaterials,
    classAssignments,
    classSchedules,
    submissions,
    role,
    setRole,
    systemConfig,
    updateSystemConfig,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    deleteAllQuestions,
    importQuestions,
    addExam,
    updateExam,
    deleteExam,
    deleteAllExams,
    addPrivateClass,
    updatePrivateClass,
    deletePrivateClass,
    requestJoinClass,
    cancelJoinRequest,
    reviewClassJoinRequest,
    removeClassMembership,
    addClassMaterial,
    deleteClassMaterial,
    addClassAssignment,
    deleteClassAssignment,
    addClassScheduleSlot,
    updateClassScheduleSlot,
    deleteClassScheduleSlot,
    addSubmission,
    deleteSubmission,
    resetAllDemoData,
  } = useExamStore();

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    getCurrentSessionUser(),
  );
  const [guestMode, setGuestMode] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [accountModalTab, setAccountModalTab] = useState<'create' | 'list' | null>(null);
  const [profileModalTab, setProfileModalTab] = useState<'view_edit' | 'password' | null>(
    null,
  );

  const [activeView, setActiveView] = useState<AppView>('portal');
  const [activeStudentSection, setActiveStudentSection] =
    useState<StudentHomeSectionId | null>(null);
  const [studentSectionRequest, setStudentSectionRequest] = useState<{
    sectionId: StudentHomeSectionId;
    nonce: number;
  } | null>(null);
  const [lobbyExam, setLobbyExam] = useState<Exam | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedSubmission, setSelectedSubmission] =
    useState<ExamSubmission | null>(null);
  const [printableExam, setPrintableExam] = useState<Exam | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [resetToast, setResetToast] = useState(false);
  const [alerts, setAlerts] = useState<TeacherAlert[]>(() => readTeacherAlerts());
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>(() => readSystemLogs());
  const [liveToasts, setLiveToasts] = useState<TeacherAlert[]>([]);
  const [alertFocus, setAlertFocus] = useState<{ sbd: string; nonce: number } | null>(null);
  const [resultsInitialFilter, setResultsInitialFilter] = useState<{
    examId?: string;
    className?: string;
    nonce: number;
  } | null>(null);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(TEACHER_ALERT_SOUND_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RIGHT_SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] = useState(false);
  const [guestSubmissionIds, setGuestSubmissionIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(GUEST_SUBMISSION_IDS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
    } catch {
      return new Set();
    }
  });
  const { isDark, toggleTheme } = useTheme();
  const activeSessionRef = useRef(activeSession);
  const roleRef = useRef(role);
  const activeViewRef = useRef(activeView);
  const alertSoundRef = useRef(alertSoundEnabled);
  const currentUserRef = useRef(currentUser);
  const allExamMapRef = useRef<Map<string, Exam>>(new Map());

  useEffect(() => {
    void ensureSeedAccounts();
  }, []);

  useEffect(() => {
    if (currentUser && role !== currentUser.role) {
      setRole(currentUser.role);
    }
  }, [currentUser, role, setRole]);

  useEffect(() => {
    if (
      role === 'student' &&
      (activeView === 'exam_manager' ||
        activeView === 'question_bank' ||
        activeView === 'admin')
    ) {
      setActiveView('portal');
    } else if (role !== 'admin' && activeView === 'admin') {
      setActiveView('portal');
    }
  }, [activeView, role]);

  const myPrivateClasses = useMemo(
    () => privateClasses.filter((pc) => isTeacherPrivateClassOwner(pc, currentUser)),
    [privateClasses, currentUser],
  );

  const pendingJoinRequestsCount = useMemo(() => {
    const myIds = new Set(myPrivateClasses.map((pc) => pc.id));
    return classJoinRequests.filter(
      (r) => myIds.has(r.classId) && r.status === 'pending',
    ).length;
  }, [classJoinRequests, myPrivateClasses]);

  const allExamMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  const visibleExams = useMemo(
    () => exams.filter((ex) => canUserViewExam(ex, currentUser)),
    [exams, currentUser],
  );

  const visibleSubmissions = useMemo(
    () =>
      submissions.filter((sub) =>
        canUserViewSubmission(
          sub,
          allExamMap.get(sub.examId),
          currentUser,
          role,
          guestSubmissionIds,
        ),
      ),
    [submissions, allExamMap, currentUser, role, guestSubmissionIds],
  );

  const visibleAlerts = useMemo(() => {
    const effectiveRole = currentUser?.role ?? role;
    if (effectiveRole === 'student') return [];
    return alerts.filter((al) => {
      const ex = allExamMap.get(al.examId);
      return ex ? canUserViewExam(ex, currentUser) : true;
    });
  }, [alerts, allExamMap, currentUser, role]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    allExamMapRef.current = allExamMap;
  }, [allExamMap]);

  useEffect(() => {
    alertSoundRef.current = alertSoundEnabled;
    try {
      localStorage.setItem(TEACHER_ALERT_SOUND_KEY, String(alertSoundEnabled));
    } catch {
      // Ignore storage error
    }
  }, [alertSoundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_COLLAPSED_KEY,
        String(rightSidebarCollapsed),
      );
    } catch {
      // Ignore storage error
    }
  }, [rightSidebarCollapsed]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        GUEST_SUBMISSION_IDS_KEY,
        JSON.stringify(Array.from(guestSubmissionIds)),
      );
    } catch {
      // Ignore storage error
    }
  }, [guestSubmissionIds]);

  const playTeacherAlertTone = useCallback(() => {
    if (!alertSoundRef.current || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const playNotes = () => {
        const now = ctx.currentTime;
        [
          { freq: 784, offset: 0, dur: 0.12 },
          { freq: 1046.5, offset: 0.14, dur: 0.2 },
        ].forEach(({ freq, offset, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + dur + 0.02);
        });
        window.setTimeout(() => {
          ctx.close().catch(() => {});
        }, 600);
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(playNotes).catch(() => {});
      } else {
        playNotes();
      }
    } catch {
      // Ignore audio errors
    }
  }, []);

  useEffect(() => {
    return subscribeTeacherAlerts(
      (incoming) => {
        if (activeSessionRef.current) return;
        const incomingExam = allExamMapRef.current.get(incoming.examId);
        if (incomingExam && !canUserViewExam(incomingExam, currentUserRef.current)) return;

        const shouldShowToast =
          roleRef.current === 'teacher' ||
          roleRef.current === 'admin' ||
          activeViewRef.current === 'results' ||
          activeViewRef.current === 'exam_manager' ||
          activeViewRef.current === 'question_bank' ||
          activeViewRef.current === 'admin';
        if (!shouldShowToast) return;

        setLiveToasts((prev) => {
          if (prev.some((t) => t.id === incoming.id)) return prev;
          return [incoming, ...prev].slice(0, 4);
        });
        playTeacherAlertTone();
        window.setTimeout(() => {
          setLiveToasts((prev) => prev.filter((t) => t.id !== incoming.id));
        }, 8500);
      },
      (synced) => {
        setAlerts(synced);
      },
    );
  }, [playTeacherAlertTone]);

  useEffect(() => {
    return subscribeSystemLogs((synced) => {
      setSystemLogs(synced);
    });
  }, []);

  const handleInspectAlert = useCallback((alert: TeacherAlert) => {
    setAlerts(markTeacherAlertRead(alert.id));
    setLiveToasts((prev) => prev.filter((t) => t.id !== alert.id));
    setSelectedSubmission(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setActiveView('results');
    setAlertFocus({ sbd: alert.studentSbd, nonce: Date.now() });
  }, []);

  const handleTriggerTestAlert = useCallback(() => {
    const sampleEvents = [
      {
        actionType: 'violation' as const,
        title: 'Chuyển tab trình duyệt',
        detail: 'Phát hiện thí sinh rời thẻ trình duyệt phòng thi trong khi đang làm bài',
        severity: 'critical' as const,
      },
      {
        actionType: 'network_offline' as const,
        title: 'Mất kết nối mạng',
        detail: 'Thí sinh bị mất kết nối mạng Internet trong phòng thi trực tuyến',
        severity: 'critical' as const,
      },
      {
        actionType: 'paused_exam' as const,
        title: 'Tạm dừng bài thi',
        detail: 'Thí sinh tạm dừng làm bài (thời gian còn lại 32:15)',
        severity: 'warning' as const,
      },
    ];
    const picked = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
    const refSub = visibleSubmissions[2] ?? visibleSubmissions[0];
    pushTeacherAlert({
      studentName: refSub?.studentName ?? 'Lê Hoàng Nam',
      studentSbd: refSub?.studentSbd ?? '0102483',
      studentClass: refSub?.studentClass ?? '12A2',
      examId: refSub?.examId ?? 'exam_toan_tn2025',
      examTitle: refSub?.examTitle ?? 'Đề tham khảo Tốt nghiệp THPT 2025 — Môn Toán',
      roomCode: refSub?.roomCode ?? 'TOAN2025',
      variantCode: refSub?.variantCode ?? '0103',
      ...picked,
    });
  }, [visibleSubmissions]);

  // Global keyboard shortcuts when outside active ExamRoom
  useEffect(() => {
    if (activeSession || (!currentUser && !guestMode)) return;

    const VIEW_BY_DIGIT: Record<string, AppView> = {
      '1': 'portal',
      '2': 'exam_manager',
      '3': 'question_bank',
      '4': 'results',
      '5': 'admin',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (isEditable && target) {
          target.blur();
          return;
        }
        if (mobileRightSidebarOpen) {
          setMobileRightSidebarOpen(false);
        } else if (profileModalTab) {
          setProfileModalTab(null);
        } else if (accountModalTab) {
          setAccountModalTab(null);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else if (lobbyExam) {
          setLobbyExam(null);
        } else if (printableExam) {
          setPrintableExam(null);
        } else if (selectedSubmission) {
          setSelectedSubmission(null);
        }
        return;
      }

      if (isEditable) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // Skip background shortcuts while any overlay modal is open
      if (profileModalTab || accountModalTab || shortcutsOpen || lobbyExam || printableExam) return;

      const targetView = VIEW_BY_DIGIT[e.key];
      if (targetView) {
        if (
          role === 'student' &&
          (targetView === 'exam_manager' ||
            targetView === 'question_bank' ||
            targetView === 'admin')
        ) {
          return;
        }
        if (targetView === 'admin' && role !== 'admin') {
          return;
        }
        e.preventDefault();
        setSelectedSubmission(null);
        setActiveView(targetView);
        return;
      }

      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setRightSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    accountModalTab,
    activeSession,
    currentUser,
    guestMode,
    lobbyExam,
    mobileRightSidebarOpen,
    printableExam,
    profileModalTab,
    role,
    selectedSubmission,
    shortcutsOpen,
    toggleTheme,
  ]);

  const firstActiveExam = useMemo(
    () => visibleExams.find((e) => e.status === 'active') ?? null,
    [visibleExams],
  );

  const handlePrimaryAction = () => {
    setSelectedSubmission(null);
    if (role === 'teacher' || role === 'admin') {
      setActiveView('exam_manager');
    } else if (firstActiveExam) {
      setLobbyExam(firstActiveExam);
    } else {
      setActiveView('portal');
    }
  };

  const handleJoinByRoomCode = (code: string): string | null => {
    const found = visibleExams.find(
      (ex) => ex.roomCode.toUpperCase() === code.toUpperCase(),
    );
    if (!found) {
      return `Không tìm thấy phòng thi mang mã "${code}". Hãy thử TOAN2025, VATLI25, HOAHOC25 hoặc TINHOC15.`;
    }
    if (found.status !== 'active') {
      return `Phòng thi "${code}" hiện đang đóng.`;
    }
    setLobbyExam(found);
    return null;
  };

  const handleStartExam = (candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
    variantCode: string;
  }) => {
    if (!lobbyExam) return;
    const variant = generateExamVariant(lobbyExam, questionMap, candidate.variantCode);
    appendSystemLog({
      category: 'exam',
      level: 'info',
      action: 'Vào phòng thi trực tuyến',
      detail: `${candidate.studentName} (${candidate.studentSbd} · ${candidate.studentClass}) bắt đầu làm đề "${lobbyExam.title}".`,
      actorName: candidate.studentName,
      actorRole: currentUser?.role ?? role,
      actorId: currentUser?.id,
      targetLabel: `${lobbyExam.roomCode} · Mã đề ${candidate.variantCode}`,
    });
    setActiveSession({
      exam: lobbyExam,
      variant,
      candidate: {
        studentName: candidate.studentName,
        studentSbd: candidate.studentSbd,
        studentClass: candidate.studentClass,
      },
    });
    setLobbyExam(null);
    setSelectedSubmission(null);
  };

  const handleSubmitComplete = (submission: ExamSubmission) => {
    const stampedSubmission: ExamSubmission = currentUser
      ? { ...submission, submittedByUserId: currentUser.id }
      : submission;
    if (!currentUser && role === 'student') {
      setGuestSubmissionIds((prev) => {
        const next = new Set(prev);
        next.add(stampedSubmission.id);
        return next;
      });
    }
    addSubmission(stampedSubmission);
    setActiveSession(null);
    setSelectedSubmission(stampedSubmission);
  };

  const handleAuthenticated = (user: UserAccount) => {
    setCurrentUser(user);
    setGuestMode(false);
    setRole(user.role);
    setSelectedSubmission(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setActiveView(user.role === 'admin' ? 'admin' : 'portal');
  };

  const handleLogout = () => {
    if (currentUser) {
      appendSystemLog({
        category: 'auth',
        level: 'info',
        action: 'Đăng xuất tài khoản',
        detail: `${currentUser.fullName} (${currentUser.email}) đã đăng xuất khỏi hệ thống.`,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        actorId: currentUser.id,
        targetLabel: currentUser.email,
      });
    }
    setCurrentSessionUserId(null);
    setCurrentUser(null);
    setProfileModalTab(null);
    setGuestMode(false);
    setSelectedSubmission(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setAuthInitialMode('login');
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setGuestMode(false);
  };

  // Live Examination Room takes full distraction-free viewport
  if (activeSession) {
    return (
      <ExamRoom
        exam={activeSession.exam}
        variant={activeSession.variant}
        candidate={activeSession.candidate}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSubmitComplete={handleSubmitComplete}
        onAbortExit={() => {
          appendSystemLog({
            category: 'exam',
            level: 'warning',
            action: 'Thoát phòng thi giữa chừng',
            detail: `${activeSession.candidate.studentName} (${activeSession.candidate.studentSbd}) đã rời phòng thi "${activeSession.exam.title}" trước khi nộp bài.`,
            actorName: activeSession.candidate.studentName,
            actorRole: currentUser?.role ?? role,
            actorId: currentUser?.id,
            targetLabel: activeSession.exam.roomCode,
          });
          setActiveSession(null);
        }}
      />
    );
  }

  // Show Login / Register screen when unauthenticated and not in guest preview
  if (!currentUser && !guestMode) {
    return (
      <AuthScreen
        initialMode={authInitialMode}
        allowSelfRegistration={systemConfig.allowSelfRegistration}
        allowGuestPreview={systemConfig.allowGuestPreview}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onAuthenticated={handleAuthenticated}
        onContinueGuest={() => setGuestMode(true)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          setSelectedSubmission(null);
          setActiveStudentSection(null);
          setActiveView(view);
        }}
        role={role}
        currentUser={currentUser}
        onPrimaryAction={handlePrimaryAction}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={(tab = 'view_edit') => setProfileModalTab(tab)}
        onOpenAccountManager={(tab) => setAccountModalTab(tab)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        alerts={visibleAlerts}
        alertSoundEnabled={alertSoundEnabled}
        onToggleAlertSound={() => setAlertSoundEnabled((v) => !v)}
        onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
        onMarkAllAlertsRead={() => setAlerts(markAllTeacherAlertsRead())}
        onClearAlerts={() => {
          setAlerts(clearAllTeacherAlerts());
          setLiveToasts([]);
        }}
        onInspectAlert={handleInspectAlert}
        onTriggerTestAlert={handleTriggerTestAlert}
        rightSidebarCollapsed={rightSidebarCollapsed}
        onToggleRightSidebar={() => setRightSidebarCollapsed((v) => !v)}
        onOpenMobileRightSidebar={() => setMobileRightSidebarOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
        {selectedSubmission ? (
          <ExamResultView
            submission={selectedSubmission}
            showSolutions={
              visibleExams.find((e) => e.id === selectedSubmission.examId)
                ?.showSolutionsAfterSubmit ?? true
            }
            onBack={() => setSelectedSubmission(null)}
          />
        ) : activeView === 'portal' ? (
          <PortalOverview
            role={role}
            currentUser={currentUser}
            systemConfig={systemConfig}
            privateClasses={myPrivateClasses}
            allPrivateClasses={privateClasses}
            classJoinRequests={classJoinRequests}
            classMaterials={classMaterials}
            classAssignments={classAssignments}
            classSchedules={classSchedules}
            onAddPrivateClass={addPrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onRequestJoinClass={(targetClass) =>
              requestJoinClass({
                targetClass,
                studentUserId: currentUser?.id ?? 'guest_student',
                studentName: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                studentSbd: currentUser?.studentSbd,
                studentClass: currentUser?.studentClass,
                studentEmail: currentUser?.email,
                actorRole: currentUser?.role ?? 'guest',
              })
            }
            onCancelJoinRequest={(reqId) =>
              cancelJoinRequest(reqId, {
                name: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                role: currentUser?.role ?? 'guest',
                id: currentUser?.id,
              })
            }
            onReviewJoinRequest={(reqId, decision) =>
              reviewClassJoinRequest(reqId, decision, {
                name: currentUser?.fullName ?? 'Giáo viên',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
              })
            }
            onRemoveClassMember={(classId, studentUserId) =>
              removeClassMembership(classId, studentUserId, {
                name: currentUser?.fullName ?? 'Người dùng',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
                reason: role === 'teacher' ? 'teacher_removed' : 'student_left',
              })
            }
            onAddClassMaterial={addClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddScheduleSlot={addClassScheduleSlot}
            onUpdateScheduleSlot={updateClassScheduleSlot}
            onDeleteScheduleSlot={deleteClassScheduleSlot}
            onChangeRole={(nextRole) => {
              setSelectedSubmission(null);
              setRole(nextRole);
            }}
            onOpenAuth={handleOpenAuth}
            exams={visibleExams}
            questions={questions}
            submissions={visibleSubmissions}
            onSelectExamToStart={(exam) => setLobbyExam(exam)}
            onJoinByRoomCode={handleJoinByRoomCode}
            onOpenPrintableExam={(exam) => setPrintableExam(exam)}
            onNavigate={(view) => setActiveView(view)}
            onCreateExam={() => setActiveView('exam_manager')}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            requestedStudentSection={studentSectionRequest}
            onStudentSectionActivated={(sec) => setActiveStudentSection(sec)}
          />
        ) : activeView === 'question_bank' ? (
          <QuestionBankManager
            questions={questions}
            currentUser={currentUser}
            privateClasses={myPrivateClasses}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={deleteQuestion}
            onDeleteAllQuestions={deleteAllQuestions}
            onImportQuestions={importQuestions}
            onCreateExam={addExam}
          />
        ) : activeView === 'exam_manager' ? (
          <ExamManager
            exams={visibleExams}
            questions={questions}
            submissions={visibleSubmissions}
            currentUser={currentUser}
            privateClasses={myPrivateClasses}
            classMaterials={classMaterials}
            classAssignments={classAssignments}
            classSchedules={classSchedules}
            onAddExam={addExam}
            onUpdateExam={updateExam}
            onDeleteExam={deleteExam}
            onAddQuestion={addQuestion}
            onAddPrivateClass={addPrivateClass}
            onUpdatePrivateClass={updatePrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onAddClassMaterial={addClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddClassScheduleSlot={addClassScheduleSlot}
            onUpdateClassScheduleSlot={updateClassScheduleSlot}
            onDeleteClassScheduleSlot={deleteClassScheduleSlot}
            onImportQuestions={importQuestions}
            onPrintExam={(exam) => setPrintableExam(exam)}
            onStartExam={(exam) => setLobbyExam(exam)}
            onViewExamResults={(examId, className) => {
              setSelectedSubmission(null);
              setResultsInitialFilter({ examId, className, nonce: Date.now() });
              setActiveView('results');
            }}
            onOpenAuth={handleOpenAuth}
          />
        ) : activeView === 'results' ? (
          <ResultsLedger
            submissions={visibleSubmissions}
            exams={visibleExams}
            role={role}
            currentUser={currentUser}
            isDark={isDark}
            alerts={visibleAlerts}
            focusAlert={alertFocus}
            initialFilter={resultsInitialFilter}
            onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
          />
        ) : activeView === 'admin' && role === 'admin' ? (
          <AdminDashboard
            currentUser={currentUser}
            isDark={isDark}
            questions={questions}
            exams={visibleExams}
            submissions={visibleSubmissions}
            alerts={visibleAlerts}
            systemLogs={systemLogs}
            systemConfig={systemConfig}
            onUpdateSystemConfig={updateSystemConfig}
            onNavigate={(view) => setActiveView(view)}
            onUpdateExam={updateExam}
            onDeleteExam={deleteExam}
            onDeleteAllExams={() => {
              deleteAllExams(visibleExams.map((e) => e.id));
              setLobbyExam(null);
              setPrintableExam(null);
            }}
            onDeleteAllQuestions={() => deleteAllQuestions()}
            onPrintExam={(exam) => setPrintableExam(exam)}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            onDeleteSubmission={deleteSubmission}
            onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
            onMarkAllAlertsRead={() => setAlerts(markAllTeacherAlertsRead())}
            onClearAlerts={() => {
              setAlerts(clearAllTeacherAlerts());
              setLiveToasts([]);
            }}
            onTriggerTestAlert={handleTriggerTestAlert}
            onClearSystemLogs={() => setSystemLogs(clearSystemLogs())}
            onSwitchAccount={(user) => {
              setCurrentUser(user);
              setRole(user.role);
              setSelectedSubmission(null);
              setLobbyExam(null);
              setPrintableExam(null);
              setActiveView(user.role === 'admin' ? 'admin' : 'portal');
            }}
            onResetAllData={() => {
              resetAllDemoData();
              void resetSeedAccounts();
              setAlerts(resetSeedTeacherAlerts());
              setSystemLogs(resetSeedSystemLogs());
              setLiveToasts([]);
            }}
          />
        ) : (
          <PortalOverview
            role={role}
            currentUser={currentUser}
            systemConfig={systemConfig}
            privateClasses={myPrivateClasses}
            allPrivateClasses={privateClasses}
            classJoinRequests={classJoinRequests}
            classMaterials={classMaterials}
            classAssignments={classAssignments}
            classSchedules={classSchedules}
            onAddPrivateClass={addPrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onRequestJoinClass={(targetClass) =>
              requestJoinClass({
                targetClass,
                studentUserId: currentUser?.id ?? 'guest_student',
                studentName: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                studentSbd: currentUser?.studentSbd,
                studentClass: currentUser?.studentClass,
                studentEmail: currentUser?.email,
                actorRole: currentUser?.role ?? 'guest',
              })
            }
            onCancelJoinRequest={(reqId) =>
              cancelJoinRequest(reqId, {
                name: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                role: currentUser?.role ?? 'guest',
                id: currentUser?.id,
              })
            }
            onReviewJoinRequest={(reqId, decision) =>
              reviewClassJoinRequest(reqId, decision, {
                name: currentUser?.fullName ?? 'Giáo viên',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
              })
            }
            onRemoveClassMember={(classId, studentUserId) =>
              removeClassMembership(classId, studentUserId, {
                name: currentUser?.fullName ?? 'Người dùng',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
                reason: role === 'teacher' ? 'teacher_removed' : 'student_left',
              })
            }
            onAddClassMaterial={addClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddScheduleSlot={addClassScheduleSlot}
            onUpdateScheduleSlot={updateClassScheduleSlot}
            onDeleteScheduleSlot={deleteClassScheduleSlot}
            onChangeRole={(nextRole) => {
              setSelectedSubmission(null);
              setRole(nextRole);
            }}
            onOpenAuth={handleOpenAuth}
            exams={visibleExams}
            questions={questions}
            submissions={visibleSubmissions}
            onSelectExamToStart={(exam) => setLobbyExam(exam)}
            onJoinByRoomCode={handleJoinByRoomCode}
            onOpenPrintableExam={(exam) => setPrintableExam(exam)}
            onNavigate={(view) => setActiveView(view)}
            onCreateExam={() => setActiveView('exam_manager')}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            requestedStudentSection={studentSectionRequest}
            onStudentSectionActivated={(sec) => setActiveStudentSection(sec)}
          />
        )}
      </main>

      <footer className="no-print mt-12 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:text-slate-400">
          <p>
            KỳThi 2025 · Hệ thống Tổ chức Thi và Kiểm tra Trắc nghiệm Trực tuyến theo Quy chuẩn Bộ
            GD&amp;ĐT 2025
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Phím tắt (?)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                resetAllDemoData();
                void resetSeedAccounts();
                setAlerts(resetSeedTeacherAlerts());
                setSystemLogs(resetSeedSystemLogs());
                setLiveToasts([]);
                setResetToast(true);
                setTimeout(() => setResetToast(false), 3000);
              }}
              className="cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {resetToast ? 'Đã khôi phục dữ liệu mẫu!' : 'Khôi phục dữ liệu mẫu'}
            </button>
          </div>
        </div>
      </footer>
        </div>

        <RightSidebar
          activeView={activeView}
          onNavigate={(view) => {
            setSelectedSubmission(null);
            setActiveStudentSection(null);
            setActiveView(view);
          }}
          role={role}
          currentUser={currentUser}
          collapsed={rightSidebarCollapsed}
          onToggleCollapse={() => setRightSidebarCollapsed((v) => !v)}
          mobileOpen={mobileRightSidebarOpen}
          onCloseMobile={() => setMobileRightSidebarOpen(false)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onPrimaryAction={handlePrimaryAction}
          onOpenAuth={handleOpenAuth}
          onOpenProfile={(tab = 'view_edit') => setProfileModalTab(tab)}
          onOpenAccountManager={(tab) => setAccountModalTab(tab)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onLogout={handleLogout}
          unreadAlertsCount={visibleAlerts.filter((a) => !a.read).length}
          pendingJoinRequestsCount={pendingJoinRequestsCount}
          activeStudentSection={
            activeView === 'portal' && !selectedSubmission ? activeStudentSection : null
          }
          onSelectStudentSection={(sectionId) => {
            setSelectedSubmission(null);
            setActiveView('portal');
            setActiveStudentSection(sectionId);
            setStudentSectionRequest({ sectionId, nonce: Date.now() });
          }}
        />
      </div>

      {lobbyExam && (
        <ExamLobbyModal
          exam={lobbyExam}
          currentUser={currentUser}
          onCancel={() => setLobbyExam(null)}
          onStartExam={handleStartExam}
        />
      )}

      {printableExam && (
        <PrintableExamModal
          exam={printableExam}
          questionMap={questionMap}
          onClose={() => setPrintableExam(null)}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcutsModal
          mode="portal"
          onClose={() => setShortcutsOpen(false)}
        />
      )}

      {profileModalTab && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          initialTab={profileModalTab}
          onClose={() => setProfileModalTab(null)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}

      {accountModalTab && (
        <AccountManagerModal
          initialTab={accountModalTab}
          currentUser={currentUser}
          onClose={() => setAccountModalTab(null)}
          onAccountChanged={(user) => {
            setCurrentUser(user);
            setSelectedSubmission(null);
            setLobbyExam(null);
            setPrintableExam(null);
            if (user) {
              setRole(user.role);
              setActiveView(user.role === 'admin' ? 'admin' : 'portal');
            }
          }}
        />
      )}

      <TeacherAlertToastStack
        toasts={liveToasts}
        onDismiss={(id) => setLiveToasts((prev) => prev.filter((t) => t.id !== id))}
        onInspectAlert={handleInspectAlert}
      />
    </div>
  );
}
