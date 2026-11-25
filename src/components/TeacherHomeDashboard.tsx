import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Copy,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  LogIn,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  derivePrivateClassCode,
  downloadClassMaterialTxt,
} from '../data/studentPortalData';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  GradeLevel,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import {
  calculateExamMaxRawScore,
  classifyAcademicRankTT22,
  EXAM_CATEGORY_LABELS,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getSubjectMeta,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import type { AppView } from './Header';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

interface TeacherHomeDashboardProps {
  currentUser: UserAccount | null;
  exams: Exam[];
  submissions: ExamSubmission[];
  privateClasses: TeacherPrivateClass[];
  allPrivateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  classSchedules: ClassScheduleSlot[];
  onAddPrivateClass: (cls: TeacherPrivateClass) => void;
  onDeletePrivateClass: (id: string) => void;
  onReviewJoinRequest: (requestId: string, decision: 'approved' | 'rejected') => void;
  onRemoveClassMember: (classId: string, studentUserId: string) => void;
  onAddClassMaterial: (material: ClassMaterial) => void;
  onDeleteClassMaterial: (id: string) => void;
  onAddClassAssignment: (assignment: ClassAssignment) => void;
  onDeleteClassAssignment: (id: string) => void;
  onAddScheduleSlot: (slot: ClassScheduleSlot) => void;
  onUpdateScheduleSlot: (slot: ClassScheduleSlot) => void;
  onDeleteScheduleSlot: (id: string) => void;
  onSelectExamToStart: (exam: Exam) => void;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  requestedSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onSectionActivated?: (sectionId: StudentHomeSectionId) => void;
}

type TeacherClassRoomTab = 'students' | 'exams' | 'materials' | 'assignments' | 'schedule';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function suggestClassCode(grade: GradeLevel, subject: SubjectId): string {
  const shortSub = (subject || 'LOP').replace('_', '').toUpperCase().slice(0, 5);
  const gradeToken =
    String(grade).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || '12';
  const rand = Math.floor(10 + Math.random() * 89);
  const prefix = /^\d{1,2}$/.test(gradeToken) ? `${gradeToken}A${rand}` : `${gradeToken}-${rand}`;
  return `${prefix}-${shortSub}`;
}

export function TeacherHomeDashboard({
  currentUser,
  exams,
  submissions,
  privateClasses,
  allPrivateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  classSchedules,
  onAddPrivateClass,
  onDeletePrivateClass,
  onReviewJoinRequest,
  onRemoveClassMember,
  onAddClassMaterial,
  onDeleteClassMaterial,
  onAddClassAssignment,
  onDeleteClassAssignment,
  onAddScheduleSlot,
  onUpdateScheduleSlot,
  onDeleteScheduleSlot,
  onSelectExamToStart,
  onOpenPrintableExam,
  onNavigate,
  onViewSubmission,
  onOpenAuth,
  requestedSection,
  onSectionActivated,
}: TeacherHomeDashboardProps) {
  useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [classRoomTab, setClassRoomTab] = useState<TeacherClassRoomTab>('students');

  // Search teacher's classes
  const [classSearchInput, setClassSearchInput] = useState('');
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  // Create new class inline form state
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState(() => suggestClassCode(12, ''));
  const [newClassSubject, setNewClassSubject] = useState<SubjectId>('');
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(12);
  const [newClassDesc, setNewClassDesc] = useState('');
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Create Material form state
  const [createMaterialOpen, setCreateMaterialOpen] = useState(false);
  const [matClassId, setMatClassId] = useState<string>('');
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState('Tài liệu ôn tập');
  const [matSummary, setMatSummary] = useState('');
  const [matKeyPoints, setMatKeyPoints] = useState('');
  const [matContent, setMatContent] = useState('');
  const [matError, setMatError] = useState<string | null>(null);
  const [materialSubjectFilter, setMaterialSubjectFilter] = useState<'all' | SubjectId>(
    'all',
  );
  const [activeMaterial, setActiveMaterial] = useState<ClassMaterial | null>(null);

  // Create Assignment form state
  const [createAssignOpen, setCreateAssignOpen] = useState(false);
  const [asgClassId, setAsgClassId] = useState<string>('');
  const [asgTitle, setAsgTitle] = useState('');
  const [asgDue, setAsgDue] = useState('Thứ 6 · 21:00');
  const [asgMinutes, setAsgMinutes] = useState(20);
  const [asgRoomCode, setAsgRoomCode] = useState('');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgError, setAsgError] = useState<string | null>(null);

  // Exam filter state
  const [examSubjectFilter, setExamSubjectFilter] = useState<'all' | SubjectId>('all');

  const myClassIds = useMemo(
    () => new Set(privateClasses.map((pc) => pc.id)),
    [privateClasses],
  );

  const classMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const allClassCodesSet = useMemo(
    () => new Set(allPrivateClasses.map((pc) => derivePrivateClassCode(pc))),
    [allPrivateClasses],
  );

  useEffect(() => {
    if (privateClasses.length > 0) {
      if (!matClassId || !myClassIds.has(matClassId)) {
        setMatClassId(privateClasses[0].id);
      }
      if (!asgClassId || !myClassIds.has(asgClassId)) {
        setAsgClassId(privateClasses[0].id);
      }
    }
  }, [asgClassId, matClassId, myClassIds, privateClasses]);

  const myPendingJoinRequests = useMemo(
    () =>
      classJoinRequests.filter(
        (r) => myClassIds.has(r.classId) && r.status === 'pending',
      ),
    [classJoinRequests, myClassIds],
  );

  const myApprovedRequests = useMemo(
    () =>
      classJoinRequests.filter(
        (r) => myClassIds.has(r.classId) && r.status === 'approved',
      ),
    [classJoinRequests, myClassIds],
  );

  const filteredTeacherClasses = useMemo(() => {
    const q = normalizeSearchText(classSearchInput);
    if (!q) return privateClasses;
    return privateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const name = normalizeSearchText(pc.name);
      return code.includes(q) || name.includes(q);
    });
  }, [classSearchInput, privateClasses]);

  const myClassSchedules = useMemo(
    () => classSchedules.filter((s) => myClassIds.has(s.classId)),
    [classSchedules, myClassIds],
  );

  const myClassMaterials = useMemo(() => {
    return classMaterials.filter((m) => {
      if (!myClassIds.has(m.classId)) return false;
      if (materialSubjectFilter !== 'all' && m.subject !== materialSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [classMaterials, materialSubjectFilter, myClassIds]);

  const myClassAssignments = useMemo(
    () => classAssignments.filter((a) => myClassIds.has(a.classId)),
    [classAssignments, myClassIds],
  );

  const myExams = useMemo(() => {
    return exams.filter((ex) => {
      const owned =
        (ex.privateClassId && myClassIds.has(ex.privateClassId)) ||
        (currentUser && ex.ownerTeacherId === currentUser.id) ||
        (!currentUser && !ex.isPrivate);
      if (!owned) return false;
      if (examSubjectFilter !== 'all' && ex.subject !== examSubjectFilter) return false;
      return true;
    });
  }, [currentUser, examSubjectFilter, exams, myClassIds]);

  const scoreStats = useMemo(() => {
    if (submissions.length === 0) return { count: 0, avg: 0, best: 0 };
    const sum = submissions.reduce((acc, s) => acc + s.totalScore, 0);
    const best = Math.max(...submissions.map((s) => s.totalScore));
    return {
      count: submissions.length,
      avg: sum / submissions.length,
      best,
    };
  }, [submissions]);

  const scrollToSection = (sectionId: StudentHomeSectionId) => {
    onSectionActivated?.(sectionId);
    const el = document.getElementById(`portal-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!requestedSection) return;
    setActiveClassId(null);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(
        `portal-section-${requestedSection.sectionId}`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  const handleCopyCode = (classId: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedClassId(classId);
    window.setTimeout(() => {
      setCopiedClassId((prev) => (prev === classId ? null : prev));
    }, 2000);
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setCreateClassError('Vui lòng đăng nhập tài khoản Giáo viên để tạo lớp học mới.');
      return;
    }
    const cleanName = newClassName.trim();
    if (cleanName.length < 2) {
      setCreateClassError('Vui lòng nhập tên lớp học (tối thiểu 2 ký tự).');
      return;
    }
    const cleanCode = newClassCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (cleanCode.length < 3) {
      setCreateClassError('Vui lòng nhập mã lớp (tối thiểu 3 ký tự, VD: 12A2-TOAN).');
      return;
    }
    if (allClassCodesSet.has(cleanCode)) {
      setCreateClassError(`Mã lớp "${cleanCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      return;
    }
    if (!newClassSubject.trim()) {
      setCreateClassError('Vui lòng tìm kiếm và chọn môn học cho lớp.');
      return;
    }

    const created: TeacherPrivateClass = {
      id: `pclass_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      classCode: cleanCode,
      name: cleanName,
      subject: newClassSubject,
      grade: newClassGrade,
      description: newClassDesc.trim() || undefined,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    };
    onAddPrivateClass(created);
    setNewClassName('');
    setNewClassDesc('');
    setNewClassSubject('');
    setNewClassCode(suggestClassCode(newClassGrade, ''));
    setCreateClassError(null);
    setCreateClassOpen(false);
  };

  const handleCreateMaterialSubmit = (e: React.FormEvent, forcedClassId?: string) => {
    e.preventDefault();
    if (!currentUser) {
      setMatError('Vui lòng đăng nhập tài khoản Giáo viên để gửi tài liệu.');
      return;
    }
    const targetClassId = forcedClassId ?? matClassId;
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setMatError('Vui lòng chọn lớp học nhận tài liệu.');
      return;
    }
    if (!matTitle.trim()) {
      setMatError('Vui lòng nhập tiêu đề tài liệu.');
      return;
    }
    const lines = matKeyPoints
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    onAddClassMaterial({
      id: `cmat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: matTitle.trim(),
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      category: matCategory.trim() || 'Tài liệu ôn tập',
      summary:
        matSummary.trim() ||
        `Tài liệu do ${currentUser.fullName} gửi cho lớp ${targetCls.name}.`,
      keyPoints: lines,
      contentText:
        matContent.trim() ||
        `${matTitle.trim().toUpperCase()}\nGiáo viên: ${currentUser.fullName}\nLớp: ${targetCls.name}\n\n${matSummary.trim()}`,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setMatTitle('');
    setMatSummary('');
    setMatKeyPoints('');
    setMatContent('');
    setMatError(null);
    setCreateMaterialOpen(false);
  };

  const handleCreateAssignmentSubmit = (e: React.FormEvent, forcedClassId?: string) => {
    e.preventDefault();
    if (!currentUser) {
      setAsgError('Vui lòng đăng nhập tài khoản Giáo viên để giao bài tập.');
      return;
    }
    const targetClassId = forcedClassId ?? asgClassId;
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setAsgError('Vui lòng chọn lớp học nhận bài tập.');
      return;
    }
    if (!asgTitle.trim()) {
      setAsgError('Vui lòng nhập tiêu đề bài tập.');
      return;
    }
    onAddClassAssignment({
      id: `casg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: asgTitle.trim(),
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      description:
        asgDesc.trim() ||
        `Hoàn thành bài tập ôn luyện cho lớp ${targetCls.name} trước thời hạn.`,
      dueDateLabel: asgDue.trim() || 'Cuối tuần · 21:00',
      estimatedMinutes: Math.max(5, Number(asgMinutes) || 20),
      relatedRoomCode: asgRoomCode.trim().toUpperCase() || undefined,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setAsgTitle('');
    setAsgDesc('');
    setAsgRoomCode('');
    setAsgError(null);
    setCreateAssignOpen(false);
  };

  const quickNavItems: {
    id: StudentHomeSectionId;
    label: string;
    count: number;
    badgeNote?: string;
  }[] = [
    {
      id: 'classes',
      label: 'Lớp học',
      count: privateClasses.length,
      badgeNote:
        myPendingJoinRequests.length > 0
          ? `${myPendingJoinRequests.length} chờ duyệt`
          : undefined,
    },
    { id: 'schedule', label: 'Lịch học', count: myClassSchedules.length },
    { id: 'materials', label: 'Tài liệu', count: myClassMaterials.length },
    { id: 'assignments', label: 'Bài tập', count: myClassAssignments.length },
    { id: 'exams', label: 'Bài thi', count: myExams.length },
    { id: 'scores', label: 'Bảng điểm', count: submissions.length },
  ];

  // ---------------------------------------------------------------------------
  // TEACHER CLASS ROOM WORKSPACE ("Trang lớp học" khi giáo viên bấm "Vào lớp học")
  // ---------------------------------------------------------------------------
  const activeClassObj = activeClassId ? classMap.get(activeClassId) ?? null : null;

  const activeClassPendingRequests = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'pending',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassApprovedStudents = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'approved',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassExams = useMemo(() => {
    if (!activeClassObj) return [];
    return exams.filter((ex) => ex.privateClassId === activeClassObj.id);
  }, [activeClassObj, exams]);

  const activeClassMaterials = useMemo(() => {
    if (!activeClassObj) return [];
    return classMaterials.filter((m) => m.classId === activeClassObj.id);
  }, [activeClassObj, classMaterials]);

  const activeClassAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return classAssignments.filter((a) => a.classId === activeClassObj.id);
  }, [activeClassObj, classAssignments]);

  const activeClassSchedules = useMemo(() => {
    if (!activeClassObj) return [];
    return classSchedules.filter((s) => s.classId === activeClassObj.id);
  }, [activeClassObj, classSchedules]);

  if (activeClassObj) {
    const classCode = derivePrivateClassCode(activeClassObj);
    const subjectName = getSubjectMeta(activeClassObj.subject ?? 'toan').name;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveClassId(null)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Trang chủ giáo viên</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyCode(activeClassObj.id, classCode)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 font-mono text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>
              {copiedClassId === activeClassObj.id
                ? `Đã sao chép: ${classCode}`
                : `Sao chép mã lớp: ${classCode}`}
            </span>
          </button>
        </div>

        {/* Class Header & Tabs */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {subjectName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatGradeLabel(activeClassObj.grade)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              Mã lớp: {classCode}
            </span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            {activeClassObj.name}
          </h1>

          {activeClassObj.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeClassObj.description}
            </p>
          )}

          <div
            role="tablist"
            aria-label="Quản lý nội dung lớp học"
            className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            {(
              [
                {
                  id: 'students',
                  label: `Học sinh & Duyệt lớp (${activeClassApprovedStudents.length}${
                    activeClassPendingRequests.length > 0
                      ? ` · ${activeClassPendingRequests.length} chờ`
                      : ''
                  })`,
                },
                { id: 'exams', label: `Bài thi (${activeClassExams.length})` },
                { id: 'materials', label: `Tài liệu (${activeClassMaterials.length})` },
                { id: 'assignments', label: `Bài tập (${activeClassAssignments.length})` },
                { id: 'schedule', label: `Lịch học (${activeClassSchedules.length})` },
              ] as { id: TeacherClassRoomTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={classRoomTab === tab.id}
                onClick={() => setClassRoomTab(tab.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold tabular-nums transition-colors ${
                  classRoomTab === tab.id
                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tab 1: Students & Approval */}
        {classRoomTab === 'students' && (
          <div className="space-y-6">
            <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-6 dark:border-amber-900/60 dark:bg-amber-950/20">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Yêu cầu xin vào lớp chờ duyệt ({activeClassPendingRequests.length})
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Học sinh đã nhập đúng mã lớp <strong className="font-mono">{classCode}</strong>. Chỉ khi bạn bấm Duyệt, học sinh mới vào được lớp và xem bài thi/tài liệu.
              </p>

              {activeClassPendingRequests.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Hiện không có yêu cầu xin vào lớp nào đang chờ duyệt.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {activeClassPendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {req.studentName}
                          {req.studentClass ? (
                            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Lớp {req.studentClass}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {req.studentSbd ? `SBD ${req.studentSbd} · ` : ''}
                          {req.studentEmail ?? 'Tài khoản học sinh'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onReviewJoinRequest(req.id, 'approved')}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Duyệt vào lớp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewJoinRequest(req.id, 'rejected')}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>Từ chối</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Danh sách học sinh đã duyệt ({activeClassApprovedStudents.length})
              </h2>

              {activeClassApprovedStudents.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Chưa có học sinh nào được duyệt vào lớp này. Hãy chia sẻ mã lớp{' '}
                  <strong className="font-mono text-blue-700 dark:text-blue-400">
                    {classCode}
                  </strong>{' '}
                  cho học sinh của bạn.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                        <th className="px-4 py-2.5">Học sinh</th>
                        <th className="px-4 py-2.5">SBD / Lớp</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeClassApprovedStudents.map((stu) => (
                        <tr key={stu.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {stu.studentName}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                            {stu.studentSbd ?? '—'} {stu.studentClass ? `· ${stu.studentClass}` : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {stu.studentEmail ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                onRemoveClassMember(activeClassObj.id, stu.studentUserId)
                              }
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Mời rời lớp</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: Exams */}
        {classRoomTab === 'exams' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  Bài thi trong lớp {activeClassObj.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tạo hoặc gán đề thi vào lớp trong Tổ chức đề thi để học sinh được duyệt làm bài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('exam_manager')}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tổ chức đề thi</span>
              </button>
            </div>

            {activeClassExams.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Chưa có bài thi nào được gắn vào lớp học này.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeClassExams.map((exam) => {
                  const totalQ =
                    exam.part1QuestionIds.length +
                    exam.part2QuestionIds.length +
                    exam.part3QuestionIds.length;
                  const maxRaw = calculateExamMaxRawScore(exam);
                  return (
                    <article
                      key={exam.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{EXAM_CATEGORY_LABELS[exam.category]}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            Mã phòng: {exam.roomCode}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {exam.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {getExamDurationMinutes(exam)} phút · {totalQ} câu (
                          {formatScoreVi(maxRaw)} điểm)
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenPrintableExam(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Đề A4</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectExamToStart(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>Thi thử</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Materials */}
        {classRoomTab === 'materials' && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Tài liệu lớp {activeClassObj.name}
            </h2>
            <form
              onSubmit={(e) => handleCreateMaterialSubmit(e, activeClassObj.id)}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
            >
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                + Gửi tài liệu mới vào lớp
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="Tiêu đề tài liệu..."
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  placeholder="Phân loại (VD: Tài liệu ôn tập)"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={2}
                value={matSummary}
                onChange={(e) => setMatSummary(e.target.value)}
                placeholder="Tóm tắt nội dung chính..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <textarea
                rows={3}
                value={matContent}
                onChange={(e) => setMatContent(e.target.value)}
                placeholder="Nội dung chi tiết / công thức (học sinh có thể đọc nhanh hoặc tải .txt)..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {matError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {matError}
                </p>
              )}
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Đăng tài liệu vào lớp</span>
              </button>
            </form>

            {activeClassMaterials.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có tài liệu nào trong lớp học này.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassMaterials.map((mat) => (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {mat.category}
                    </p>
                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mat.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {mat.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMaterial(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Xem nội dung</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Tải .txt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClassMaterial(mat.id)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Assignments */}
        {classRoomTab === 'assignments' && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Bài tập lớp {activeClassObj.name}
            </h2>
            <form
              onSubmit={(e) => handleCreateAssignmentSubmit(e, activeClassObj.id)}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
            >
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                + Giao bài tập mới cho lớp
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="Tên bài tập..."
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={asgDue}
                  onChange={(e) => setAsgDue(e.target.value)}
                  placeholder="Hạn nộp (VD: Thứ 6 · 21:00)"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={2}
                value={asgDesc}
                onChange={(e) => setAsgDesc(e.target.value)}
                placeholder="Mô tả yêu cầu bài tập..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {asgError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {asgError}
                </p>
              )}
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Giao bài tập</span>
              </button>
            </form>

            {activeClassAssignments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có bài tập nào trong lớp học này.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassAssignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-1 last:pb-1"
                  >
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Hạn: {asg.dueDateLabel} · ~{asg.estimatedMinutes} phút
                      </p>
                      <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {asg.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {asg.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteClassAssignment(asg.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Schedule */}
        {classRoomTab === 'schedule' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Lịch học của lớp {activeClassObj.name}
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Nhấn &ldquo;+ Thêm lịch&rdquo; ở từng ngày để cập nhật thời khóa biểu; học sinh đã duyệt vào lớp sẽ xem ở chế độ chỉ đọc.
            </p>
            <WeeklyCalendarSchedule
              slots={activeClassSchedules}
              classes={[activeClassObj]}
              canEdit
              currentUser={currentUser}
              onAddSlot={onAddScheduleSlot}
              onUpdateSlot={onUpdateScheduleSlot}
              onDeleteSlot={onDeleteScheduleSlot}
              emptyNotice="Lớp học này chưa có lịch học tuần. Nhấn '+ Thêm lịch' để tạo."
            />
          </section>
        )}

        {activeMaterial && (
          <TeacherMaterialReaderModal
            material={activeMaterial}
            onClose={() => setActiveMaterial(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* THANH CHUYỂN NHANH 6 MỤC (Giống trang chủ học sinh)                   */}
      {/* ===================================================================== */}
      <nav
        aria-label="6 mục trang tổng quan giáo viên"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {quickNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-slate-800/80"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.label}
              </span>
              {item.badgeNote && (
                <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  {item.badgeNote}
                </span>
              )}
            </span>
            <span className="font-mono text-xs font-bold text-blue-700 tabular-nums dark:text-blue-400">
              {item.count}
            </span>
          </button>
        ))}
      </nav>

      {/* ===================================================================== */}
      {/* MỤC 1: LỚP HỌC (Tạo lớp học mới + Duyệt yêu cầu vào lớp bằng mã lớp) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-classes"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Lớp học
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Tạo lớp học mới kèm mã lớp riêng. Học sinh chỉ vào được khi nhập đúng mã lớp và được bạn duyệt trực tiếp tại đây.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
              {privateClasses.length} lớp · {myApprovedRequests.length} học sinh
            </p>
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setCreateClassOpen((v) => !v);
                  setCreateClassError(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                <span>{createClassOpen ? 'Đóng biểu mẫu' : 'Tạo lớp học mới'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập Giáo viên để tạo lớp</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Tạo lớp học mới */}
        {createClassOpen && currentUser && (
          <form
            onSubmit={handleCreateClassSubmit}
            className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/60 dark:bg-blue-950/20"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Tạo lớp học mới của giáo viên ({currentUser.fullName})
              </h3>
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tên lớp học *
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => {
                    setNewClassName(e.target.value);
                    if (createClassError) setCreateClassError(null);
                  }}
                  placeholder="VD: Toán 12A2 — Luyện đề THPT 2025"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mã lớp * (Học sinh dùng để xin vào)
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    value={newClassCode}
                    onChange={(e) => {
                      setNewClassCode(e.target.value.toUpperCase());
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder="VD: 12A2-TOAN"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    title="Tạo mã lớp mới"
                    onClick={() =>
                      setNewClassCode(suggestClassCode(newClassGrade, newClassSubject))
                    }
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Đổi mã
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Môn học
                  </label>
                  <SubjectSearchSelect
                    value={newClassSubject}
                    onChange={(nextSubj) => {
                      setNewClassSubject(nextSubj);
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder="Tìm tên môn..."
                    ariaLabel="Tìm kiếm và chọn môn học cho lớp"
                    currentUser={currentUser}
                    onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Khối / Số lớp
                  </label>
                  <GradeInputControl
                    value={newClassGrade}
                    onChange={(nextGrade) => setNewClassGrade(nextGrade)}
                    ariaLabel="Chọn hoặc nhập khối hoặc số lớp"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mô tả lớp học (tùy chọn)
              </label>
              <input
                type="text"
                value={newClassDesc}
                onChange={(e) => setNewClassDesc(e.target.value)}
                placeholder="VD: Lớp ôn thi TN THPT theo cấu trúc 3 dạng thức 2025..."
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {createClassError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {createClassError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Lưu &amp; Mở lớp học</span>
              </button>
            </div>
          </form>
        )}

        {/* Hàng đợi duyệt học sinh vào lớp */}
        {myPendingJoinRequests.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Yêu cầu học sinh xin vào lớp chờ bạn duyệt ({myPendingJoinRequests.length})
              </p>
              <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Học sinh đã nhập đúng mã lớp
              </span>
            </div>

            <div className="mt-3 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {myPendingJoinRequests.map((req) => {
                const cls = classMap.get(req.classId);
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {req.studentName}{' '}
                        {req.studentClass ? (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            · Lớp {req.studentClass}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                        Xin vào:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {cls?.name ?? req.classCode}
                        </strong>{' '}
                        <span className="font-mono text-blue-700 dark:text-blue-400">
                          ({req.classCode})
                        </span>
                        {req.studentSbd ? ` · SBD ${req.studentSbd}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req.id, 'approved')}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req.id, 'rejected')}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>Từ chối</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thanh tìm kiếm lớp học của giáo viên */}
        {privateClasses.length > 0 && (
          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              aria-label="Tìm lớp học của bạn theo tên hoặc mã lớp"
              value={classSearchInput}
              onChange={(e) => setClassSearchInput(e.target.value)}
              placeholder="Lọc lớp học của bạn theo tên lớp hoặc mã lớp..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {classSearchInput && (
              <button
                type="button"
                aria-label="Xóa từ khóa lọc lớp"
                onClick={() => setClassSearchInput('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Danh sách lớp học giáo viên đang quản lý */}
        {filteredTeacherClasses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Users className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {currentUser
                ? 'Bạn chưa có lớp học nào khớp bộ lọc.'
                : 'Đăng nhập tài khoản Giáo viên để tạo và quản lý lớp học.'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {currentUser
                ? 'Nhấn "Tạo lớp học mới" ở góc trên để tạo lớp và nhận mã lớp cấp cho học sinh.'
                : 'Tài khoản giáo viên mẫu: giaovien@kythi2025.edu.vn / 123456.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredTeacherClasses.map((pc) => {
              const code = derivePrivateClassCode(pc);
              const subjectName = getSubjectMeta(pc.subject ?? 'toan').name;
              const approvedCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'approved',
              ).length;
              const pendingCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'pending',
              ).length;
              const clsExamCount = exams.filter(
                (ex) => ex.privateClassId === pc.id,
              ).length;
              const clsMatCount = classMaterials.filter((m) => m.classId === pc.id).length;
              const clsAsgCount = classAssignments.filter(
                (a) => a.classId === pc.id,
              ).length;

              return (
                <article
                  key={pc.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {subjectName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatGradeLabel(pc.grade)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(pc.id, code)}
                        title="Sao chép mã lớp"
                        className="inline-flex cursor-pointer items-center gap-1 font-mono font-bold text-blue-700 hover:underline tabular-nums dark:text-blue-400"
                      >
                        <Copy className="h-3 w-3" />
                        <span>
                          {copiedClassId === pc.id ? 'Đã chép' : `Mã: ${code}`}
                        </span>
                      </button>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {pc.name}
                    </h3>

                    {pc.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pc.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {approvedCount} học sinh
                      </span>
                      {pendingCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {pendingCount} chờ duyệt
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{clsExamCount} bài thi</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsMatCount} tài liệu</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsAsgCount} bài tập</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveClassId(pc.id);
                        setClassRoomTab(pendingCount > 0 ? 'students' : 'exams');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <DoorOpen className="h-3.5 w-3.5" />
                      <span>Vào lớp học</span>
                    </button>

                    {confirmDeleteClassId === pc.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeletePrivateClass(pc.id);
                            setConfirmDeleteClassId(null);
                          }}
                          className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteClassId(null)}
                          className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteClassId(pc.id)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa lớp</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 2: LỊCH HỌC (7 cột Thứ 2 – Chủ nhật, giáo viên chỉnh sửa trực tiếp) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-schedule"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex flex-col justify-between gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Lịch học
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lịch giảng dạy tuần từ Thứ 2 đến Chủ nhật. Bạn có quyền thêm, sửa, xóa lịch học cho các lớp của mình.
            </p>
          </div>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Quyền giáo viên · Chỉnh sửa trực tiếp
          </span>
        </div>

        <WeeklyCalendarSchedule
          slots={myClassSchedules}
          classes={privateClasses}
          canEdit={Boolean(currentUser)}
          currentUser={currentUser}
          onAddSlot={onAddScheduleSlot}
          onUpdateSlot={onUpdateScheduleSlot}
          onDeleteSlot={onDeleteScheduleSlot}
          emptyNotice="Chưa có lịch học nào cho các lớp của bạn. Nhấn '+ Thêm lịch' ở từng ngày để xếp lịch."
        />
      </section>

      {/* ===================================================================== */}
      {/* MỤC 3: TÀI LIỆU & MỤC 4: BÀI TẬP                                     */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* MỤC 3: TÀI LIỆU */}
        <section
          id="portal-section-materials"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  Tài liệu
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Gửi tài liệu ôn tập lên các lớp học bạn phụ trách.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SubjectSearchSelect
                allowAll
                compact
                allLabel="Tất cả môn"
                value={materialSubjectFilter}
                onChange={(val) =>
                  setMaterialSubjectFilter((val || 'all') as 'all' | SubjectId)
                }
                ariaLabel="Lọc tài liệu theo môn học"
                currentUser={currentUser}
                onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                className="w-48"
              />
              <button
                type="button"
                onClick={() => setAddSubjectModalOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Môn học khác</span>
              </button>
              {currentUser && privateClasses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCreateMaterialOpen((v) => !v);
                    setMatError(null);
                  }}
                  className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Gửi tài liệu</span>
                </button>
              )}
            </div>
          </div>

          {createMaterialOpen && currentUser && privateClasses.length > 0 && (
            <form
              onSubmit={(e) => handleCreateMaterialSubmit(e)}
              className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"
            >
              <select
                value={matClassId}
                onChange={(e) => setMatClassId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {privateClasses.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.name} ({derivePrivateClassCode(pc)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                placeholder="Tiêu đề tài liệu..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <textarea
                rows={2}
                value={matSummary}
                onChange={(e) => setMatSummary(e.target.value)}
                placeholder="Tóm tắt tài liệu..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <textarea
                rows={3}
                value={matContent}
                onChange={(e) => setMatContent(e.target.value)}
                placeholder="Nội dung chi tiết..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {matError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {matError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateMaterialOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  Đăng tài liệu
                </button>
              </div>
            </form>
          )}

          {myClassMaterials.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <FileText className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chưa có tài liệu nào trong các lớp học của bạn.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {myClassMaterials.map((mat) => {
                const cls = classMap.get(mat.classId);
                return (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {getSubjectMeta(mat.subject).name}
                      </span>
                      {cls && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            Lớp {derivePrivateClassCode(cls)}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mat.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {mat.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMaterial(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Xem nội dung</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Tải (.txt)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClassMaterial(mat.id)}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MỤC 4: BÀI TẬP */}
        <section
          id="portal-section-assignments"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  Bài tập
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Giao bài tập luyện tập về nhà cho học sinh trong các lớp của bạn.
              </p>
            </div>

            {currentUser && privateClasses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCreateAssignOpen((v) => !v);
                  setAsgError(null);
                }}
                className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Giao bài tập</span>
              </button>
            )}
          </div>

          {createAssignOpen && currentUser && privateClasses.length > 0 && (
            <form
              onSubmit={(e) => handleCreateAssignmentSubmit(e)}
              className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"
            >
              <select
                value={asgClassId}
                onChange={(e) => setAsgClassId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {privateClasses.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.name} ({derivePrivateClassCode(pc)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={asgTitle}
                onChange={(e) => setAsgTitle(e.target.value)}
                placeholder="Tiêu đề bài tập..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={asgDue}
                  onChange={(e) => setAsgDue(e.target.value)}
                  placeholder="Hạn nộp (VD: Thứ 6 · 21:00)"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={asgMinutes}
                  onChange={(e) => setAsgMinutes(Number(e.target.value))}
                  placeholder="Số phút dự kiến"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={2}
                value={asgDesc}
                onChange={(e) => setAsgDesc(e.target.value)}
                placeholder="Mô tả yêu cầu bài tập..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {asgError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {asgError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateAssignOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  Lưu bài tập
                </button>
              </div>
            </form>
          )}

          {myClassAssignments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <ClipboardList className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chưa có bài tập nào được giao trong các lớp học của bạn.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {myClassAssignments.map((asg) => {
                const cls = classMap.get(asg.classId);
                return (
                  <div key={asg.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {getSubjectMeta(asg.subject).name}
                      </span>
                      {cls && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            Lớp {derivePrivateClassCode(cls)}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Hạn: {asg.dueDateLabel}</span>
                    </div>
                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {asg.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {asg.description}
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onDeleteClassAssignment(asg.id)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa bài tập</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================== */}
      {/* MỤC 5: BÀI THI                                                        */}
      {/* ===================================================================== */}
      <section
        id="portal-section-exams"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Bài thi
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Danh sách đề thi trong các lớp học của bạn. Nhấn Tổ chức đề thi để soạn đề mới từ Word/Excel hoặc cấu hình phòng thi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SubjectSearchSelect
              allowAll
              compact
              allLabel="Tất cả môn học"
              value={examSubjectFilter}
              onChange={(val) =>
                setExamSubjectFilter((val || 'all') as 'all' | SubjectId)
              }
              ariaLabel="Lọc bài thi theo môn học"
              currentUser={currentUser}
              onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
              className="w-48"
            />
            <button
              type="button"
              onClick={() => setAddSubjectModalOpen(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm môn học</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('exam_manager')}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo / Tổ chức đề thi</span>
            </button>
          </div>
        </div>

        {myExams.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <BookOpen className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Chưa có bài thi nào thuộc tài khoản / lớp học của bạn.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {myExams.map((exam) => {
              const subjectMeta = getSubjectMeta(exam.subject);
              const cls = exam.privateClassId ? classMap.get(exam.privateClassId) : null;
              const totalQ =
                exam.part1QuestionIds.length +
                exam.part2QuestionIds.length +
                exam.part3QuestionIds.length;
              const maxRaw = calculateExamMaxRawScore(exam);
              const subCount = submissions.filter((s) => s.examId === exam.id).length;

              return (
                <article
                  key={exam.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {subjectMeta.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {cls
                            ? `Lớp ${derivePrivateClassCode(cls)}`
                            : EXAM_CATEGORY_LABELS[exam.category]}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {exam.roomCode}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {exam.title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {getExamDurationMinutes(exam)} phút
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {totalQ} câu ({formatScoreVi(maxRaw)} điểm)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{subCount} bài nộp</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {cls && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveClassId(cls.id);
                            setClassRoomTab('exams');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <DoorOpen className="h-3.5 w-3.5" />
                          <span>Vào lớp</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenPrintableExam(exam)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Đề A4</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('exam_manager')}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Cấu hình</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectExamToStart(exam)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <span>Thi thử</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 6: BẢNG ĐIỂM (Thống kê kết quả nộp bài của học sinh)              */}
      {/* ===================================================================== */}
      <section
        id="portal-section-scores"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Bảng điểm
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tổng hợp bài làm thí sinh đã nộp và điểm thi theo cấu trúc 3 phần 2025.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Bài nộp:{' '}
                <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                  {scoreStats.count}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Điểm TB:{' '}
                <strong className="font-mono text-blue-700 tabular-nums dark:text-blue-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.avg) : '—'}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Cao nhất:{' '}
                <strong className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.best) : '—'}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Xem toàn bộ bảng điểm</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-6 py-3">SBD</th>
                <th className="px-6 py-3">Thí sinh</th>
                <th className="px-6 py-3">Kỳ thi</th>
                <th className="px-6 py-3">Mã đề</th>
                <th className="px-6 py-3 text-right">Phần I / II / III</th>
                <th className="px-6 py-3 text-right">Tổng điểm</th>
                <th className="px-6 py-3">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {submissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Chưa có bài thi nào được nộp.
                  </td>
                </tr>
              ) : (
                submissions.slice(0, 8).map((sub) => {
                  const rank = classifyAcademicRankTT22(sub.totalScore);
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onViewSubmission(sub)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                        {sub.studentSbd}
                      </td>
                      <td className="px-6 py-3.5 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {sub.studentName}
                        </span>
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                          ({sub.studentClass})
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {sub.examTitle}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {sub.variantCode}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {formatScoreVi(sub.part1Score)} / {formatScoreVi(sub.part2Score)} /{' '}
                        {formatScoreVi(sub.part3Score)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {formatScoreVi(sub.totalScore)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {rank.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeMaterial && (
        <TeacherMaterialReaderModal
          material={activeMaterial}
          onClose={() => setActiveMaterial(null)}
        />
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setNewClassSubject(created.id);
          setNewClassCode(suggestClassCode(newClassGrade, created.id));
          setAddSubjectModalOpen(false);
        }}
      />
    </div>
  );
}

function TeacherMaterialReaderModal({
  material,
  onClose,
}: {
  material: ClassMaterial;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={material.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {getSubjectMeta(material.subject).name} · {material.category}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {material.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng tài liệu"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {material.contentText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => downloadClassMaterialTxt(material)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải về (.txt)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
