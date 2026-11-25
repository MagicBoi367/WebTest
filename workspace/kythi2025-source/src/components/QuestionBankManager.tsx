import { AlertTriangle, Download, Edit3, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CognitiveLevel,
  Exam,
  GradeLevel,
  Question,
  QuestionType,
  SubjectId,
  TeacherPrivateClass,
  TrueFalseStatement,
  UserAccount,
} from '../types/exam';
import {
  areGradesEqual,
  COGNITIVE_LEVEL_LABELS,
  collectAvailableGrades,
  formatGradeLabel,
  getSubjectMeta,
  normalizeGradeValue,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import { ImportExamFilesModal } from './ImportExamFilesModal';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface QuestionBankManagerProps {
  questions: Question[];
  currentUser?: UserAccount | null;
  privateClasses?: TeacherPrivateClass[];
  onAddQuestion: (q: Question) => void;
  onUpdateQuestion: (q: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onDeleteAllQuestions?: (questionIds?: string[]) => void;
  onImportQuestions: (incoming: Question[]) => void;
  onCreateExam?: (exam: Exam) => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Phần I · Nhiều lựa chọn',
  true_false: 'Phần II · Đúng / Sai (4 ý)',
  short_answer: 'Phần III · Trả lời ngắn',
};

export function QuestionBankManager({
  questions,
  currentUser = null,
  privateClasses = [],
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onDeleteAllQuestions,
  onImportQuestions,
  onCreateExam,
}: QuestionBankManagerProps) {
  useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | CognitiveLevel>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);

  useEffect(() => {
    if (!confirmDeleteAllOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setConfirmDeleteAllOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [confirmDeleteAllOpen]);

  const filtered = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false;
      if (gradeFilter !== 'all' && !areGradesEqual(q.grade, gradeFilter)) return false;
      if (typeFilter !== 'all' && q.type !== typeFilter) return false;
      if (levelFilter !== 'all' && q.level !== levelFilter) return false;
      if (
        qLower &&
        !q.prompt.toLowerCase().includes(qLower) &&
        !q.topic.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [questions, search, subjectFilter, gradeFilter, typeFilter, levelFilter]);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngan_hang_cau_hoi_2025_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Chuẩn hóa theo Chương trình GDPT 2018 &amp; QĐ 764/QĐ-BGDĐT
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Ngân hàng câu hỏi trắc nghiệm 2025
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Quản lý câu hỏi theo 3 dạng thức và 3 mức độ nhận thức (Nhận biết · Thông hiểu · Vận
            dụng).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            <Upload className="h-4 w-4" />
            <span>Nhập file Đề &amp; Đáp án</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            <span>Xuất JSON ({filtered.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingQuestion(null);
              setModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm câu hỏi mới</span>
          </button>
          {onDeleteAllQuestions && (
            <button
              type="button"
              disabled={questions.length === 0}
              onClick={() => setConfirmDeleteAllOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
            >
              <Trash2 className="h-4 w-4" />
              <span className="tabular-nums">Xóa hết câu hỏi ({questions.length})</span>
            </button>
          )}
        </div>
      </div>

      {importFeedback && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            aria-label="Đóng thông báo nhập file"
            className="cursor-pointer rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nội dung hoặc chuyên đề..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <SubjectSearchSelect
            allowAll
            allLabel="Tất cả môn học"
            value={subjectFilter}
            onChange={(val) => setSubjectFilter((val || 'all') as 'all' | SubjectId)}
            ariaLabel="Lọc môn học"
            currentUser={currentUser}
            onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            title="Thêm môn học khác"
            onClick={() => setAddSubjectModalOpen(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Môn</span>
          </button>
        </div>

        <select
          aria-label="Lọc khối lớp"
          value={gradeFilter === 'all' ? 'all' : String(gradeFilter)}
          onChange={(e) =>
            setGradeFilter(
              e.target.value === 'all' ? 'all' : normalizeGradeValue(e.target.value),
            )
          }
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
        >
          <option value="all">Tất cả khối lớp</option>
          {collectAvailableGrades(questions, true).map((g) => (
            <option key={String(g)} value={String(g)}>
              {formatGradeLabel(g)}
            </option>
          ))}
        </select>

        <select
          aria-label="Lọc dạng câu hỏi"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | QuestionType)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
        >
          <option value="all">Tất cả 3 dạng câu hỏi</option>
          <option value="multiple_choice">Phần I · Nhiều lựa chọn</option>
          <option value="true_false">Phần II · Đúng / Sai</option>
          <option value="short_answer">Phần III · Trả lời ngắn</option>
        </select>

        <select
          aria-label="Lọc mức độ nhận thức"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as 'all' | CognitiveLevel)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
        >
          <option value="all">Tất cả mức độ nhận thức</option>
          <option value="biet">Nhận biết</option>
          <option value="hieu">Thông hiểu</option>
          <option value="van_dung">Vận dụng</option>
        </select>
      </div>

      {/* Question List */}
      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {questions.length === 0
                ? 'Ngân hàng câu hỏi hiện đang trống'
                : 'Không tìm thấy câu hỏi nào'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {questions.length === 0
                ? 'Nhấn "Thêm câu hỏi mới" hoặc "Nhập file Đề & Đáp án" để bổ sung câu hỏi vào ngân hàng.'
                : 'Thử nới lỏng bộ lọc hoặc nhấn "Thêm câu hỏi mới" để bổ sung vào ngân hàng.'}
            </p>
          </div>
        ) : (
          filtered.map((q) => (
            <article
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      {getSubjectMeta(q.subject).name} {q.grade}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{COGNITIVE_LEVEL_LABELS[q.level]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.topic}</span>
                  </div>
                  <p className="text-sm leading-relaxed font-semibold text-slate-900 dark:text-slate-100">
                    {q.prompt}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestion(q);
                      setModalOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(q.id)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>

              {/* Compact Answer Preview */}
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                {q.type === 'multiple_choice' && q.options && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 rounded-md px-3 py-2 ${
                          q.correctOptionIndex === idx
                            ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300'
                        }`}
                      >
                        <strong className="shrink-0 font-mono">{OPTION_LETTERS[idx]}.</strong>
                        <span className="min-w-0 flex-1 leading-snug break-words">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'true_false' && q.statements && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.statements.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-start justify-between gap-2.5 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2 dark:text-slate-200">
                          <strong className="shrink-0 font-mono">{st.id})</strong>
                          <span className="min-w-0 flex-1 leading-snug break-words">{st.text}</span>
                        </div>
                        <span
                          className={`shrink-0 font-mono font-bold ${
                            st.isTrue
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {st.isTrue ? 'Đúng' : 'Sai'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'short_answer' && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Đáp án chuẩn:</span>
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-mono font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {q.shortAnswer}
                    </span>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {/* Import Question & Answer Files Modal */}
      {importModalOpen && (
        <ImportExamFilesModal
          currentUser={currentUser}
          privateClasses={privateClasses}
          onClose={() => setImportModalOpen(false)}
          onImportQuestions={(incoming) => {
            onImportQuestions(incoming);
            setImportFeedback(
              `Đã nhập thành công ${incoming.length} câu hỏi từ file vào Ngân hàng câu hỏi.`,
            );
          }}
          onCreateExam={
            onCreateExam
              ? (exam) => {
                  onCreateExam(exam);
                  setImportFeedback(
                    `Đã nhập câu hỏi và tạo đề thi "${exam.title}" (Mã phòng ${exam.roomCode}).`,
                  );
                }
              : undefined
          }
        />
      )}

      {/* Create / Edit Question Modal */}
      {modalOpen && (
        <QuestionEditorModal
          initial={editingQuestion}
          onClose={() => {
            setModalOpen(false);
            setEditingQuestion(null);
          }}
          onSave={(saved) => {
            if (editingQuestion) {
              onUpdateQuestion(saved);
            } else {
              onAddQuestion(saved);
            }
            setModalOpen(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTargetId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 dark:bg-slate-950/80"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Xác nhận xóa câu hỏi?
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Câu hỏi này sẽ bị gỡ khỏi ngân hàng câu hỏi và các đề thi đang liên kết.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuestion(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Xóa câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete All Questions Confirmation */}
      {confirmDeleteAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteAllOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-questions-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="delete-all-questions-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  Xác nhận xóa hết câu hỏi?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Thao tác này sẽ xóa toàn bộ{' '}
                  <strong className="font-mono text-red-700 tabular-nums dark:text-red-400">
                    {questions.length} câu hỏi
                  </strong>{' '}
                  hiện có trong Ngân hàng câu hỏi và gỡ liên kết khỏi các đề thi tương ứng.
                </p>
                {filtered.length > 0 && filtered.length < questions.length && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                    Bộ lọc hiện tại đang hiển thị{' '}
                    <strong className="tabular-nums">{filtered.length}</strong> /{' '}
                    <strong className="tabular-nums">{questions.length}</strong> câu hỏi. Bạn có
                    thể chỉ xóa các câu đang lọc hoặc xóa sạch toàn bộ ngân hàng.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllOpen(false)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              {filtered.length > 0 && filtered.length < questions.length && (
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = filtered.map((q) => q.id);
                    onDeleteAllQuestions?.(filteredIds);
                    setDeleteTargetId(null);
                    setConfirmDeleteAllOpen(false);
                    setImportFeedback(
                      `Đã xóa ${filteredIds.length} câu hỏi theo bộ lọc khỏi Ngân hàng câu hỏi.`,
                    );
                  }}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
                >
                  <span className="tabular-nums">Chỉ xóa đang lọc ({filtered.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const totalCount = questions.length;
                  onDeleteAllQuestions?.();
                  setDeleteTargetId(null);
                  setConfirmDeleteAllOpen(false);
                  setImportFeedback(
                    `Đã xóa toàn bộ ${totalCount} câu hỏi khỏi Ngân hàng câu hỏi.`,
                  );
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="tabular-nums">Xóa hết ({questions.length} câu)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubjectFilter(created.id);
          setAddSubjectModalOpen(false);
        }}
      />
    </div>
  );
}

interface QuestionEditorModalProps {
  initial: Question | null;
  onClose: () => void;
  onSave: (q: Question) => void;
}

function QuestionEditorModal({
  initial,
  onClose,
  onSave,
}: QuestionEditorModalProps) {
  useSubjects();
  const [quickAddSubjectOpen, setQuickAddSubjectOpen] = useState(false);
  const [subject, setSubject] = useState<SubjectId>(initial?.subject ?? '');
  const [grade, setGrade] = useState<GradeLevel>(initial?.grade ?? 12);
  const [type, setType] = useState<QuestionType>(
    initial?.type ?? 'multiple_choice',
  );
  const [level, setLevel] = useState<CognitiveLevel>(initial?.level ?? 'biet');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [options, setOptions] = useState<[string, string, string, string]>(
    initial?.options ?? ['', '', '', ''],
  );
  const [correctIdx, setCorrectIdx] = useState<0 | 1 | 2 | 3>(
    initial?.correctOptionIndex ?? 0,
  );
  const [statements, setStatements] = useState<
    [
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
    ]
  >(
    initial?.statements ?? [
      { id: 'a', text: '', isTrue: true },
      { id: 'b', text: '', isTrue: false },
      { id: 'c', text: '', isTrue: true },
      { id: 'd', text: '', isTrue: false },
    ],
  );
  const [shortAnswer, setShortAnswer] = useState(initial?.shortAnswer ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Vui lòng tìm kiếm và chọn Môn học cho câu hỏi.');
      return;
    }
    if (!prompt.trim() || !topic.trim()) {
      setError('Vui lòng nhập đầy đủ Chuyên đề và Nội dung câu hỏi.');
      return;
    }

    if (type === 'multiple_choice' && options.some((o) => !o.trim())) {
      setError('Vui lòng nhập đầy đủ 4 phương án A, B, C, D.');
      return;
    }

    if (type === 'true_false' && statements.some((s) => !s.text.trim())) {
      setError('Vui lòng nhập đầy đủ nội dung cho cả 4 ý a, b, c, d.');
      return;
    }

    if (type === 'short_answer' && (!shortAnswer.trim() || shortAnswer.trim().length > 4)) {
      setError('Đáp án Phần III phải có độ dài từ 1 đến 4 ký tự (chuẩn phiếu tô 2025).');
      return;
    }

    const base: Question = {
      id: initial?.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      subject,
      grade,
      topic: topic.trim(),
      level,
      type,
      prompt: prompt.trim(),
      explanation: explanation.trim() || 'Đáp án được đối chiếu theo chuẩn chương trình GDPT 2018.',
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };

    if (type === 'multiple_choice') {
      base.options = options.map((o) => o.trim()) as [string, string, string, string];
      base.correctOptionIndex = correctIdx;
    } else if (type === 'true_false') {
      base.statements = statements.map((s) => ({
        ...s,
        text: s.text.trim(),
      })) as [
        TrueFalseStatement,
        TrueFalseStatement,
        TrueFalseStatement,
        TrueFalseStatement,
      ];
    } else {
      const normalized = shortAnswer.trim();
      const altDot = normalized.replace(/,/g, '.');
      const altComma = normalized.replace(/\./g, ',');
      base.shortAnswer = normalized;
      base.acceptedAnswers = Array.from(new Set([normalized, altDot, altComma]));
    }

    onSave(base);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {initial ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới vào Ngân hàng 2025'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="flex items-center justify-between gap-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Môn học
                </label>
                <button
                  type="button"
                  onClick={() => setQuickAddSubjectOpen(true)}
                  className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  + Thêm môn
                </button>
              </div>
              <SubjectSearchSelect
                value={subject}
                onChange={(val) => {
                  setSubject(val);
                  if (error) setError(null);
                }}
                placeholder="Tìm tên môn học..."
                ariaLabel="Tìm kiếm và chọn môn học cho câu hỏi"
                onOpenAdvancedAdd={() => setQuickAddSubjectOpen(true)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Khối / Số lớp
              </label>
              <GradeInputControl
                value={grade}
                onChange={setGrade}
                ariaLabel="Chọn hoặc nhập khối hoặc số lớp"
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mức độ nhận thức
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as CognitiveLevel)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="biet">Nhận biết</option>
                <option value="hieu">Thông hiểu</option>
                <option value="van_dung">Vận dụng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dạng thức câu hỏi 2025
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="multiple_choice">Phần I · Trắc nghiệm 4 lựa chọn</option>
                <option value="true_false">Phần II · Trắc nghiệm Đúng / Sai (4 ý)</option>
                <option value="short_answer">Phần III · Trả lời ngắn (≤ 4 ký tự)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chuyên đề / Chương
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="VD: Ứng dụng đạo hàm"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nội dung câu hỏi / Đề bài
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập câu hỏi rõ ràng..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {type === 'multiple_choice' && (
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                4 Phương án trả lời (chọn đáp án đúng)
              </span>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="correct-opt"
                    checked={correctIdx === idx}
                    onChange={() => setCorrectIdx(idx as 0 | 1 | 2 | 3)}
                    aria-label={`Chọn ${OPTION_LETTERS[idx]} làm đáp án đúng`}
                    className="h-4 w-4 text-blue-700"
                  />
                  <span className="w-5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {OPTION_LETTERS[idx]}.
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Nội dung phương án ${OPTION_LETTERS[idx]}`}
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              ))}
            </div>
          )}

          {type === 'true_false' && (
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                4 Mệnh đề thành phần a, b, c, d và đáp án Đúng/Sai
              </span>
              {statements.map((st, idx) => (
                <div key={st.id} className="flex items-center gap-2.5">
                  <span className="w-5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {st.id})
                  </span>
                  <input
                    type="text"
                    value={st.text}
                    onChange={(e) => {
                      const next = [...statements] as typeof statements;
                      next[idx] = { ...next[idx], text: e.target.value };
                      setStatements(next);
                    }}
                    placeholder={`Nội dung ý ${st.id})`}
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...statements] as typeof statements;
                      next[idx] = { ...next[idx], isTrue: !next[idx].isTrue };
                      setStatements(next);
                    }}
                    className={`min-w-[68px] cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                      st.isTrue
                        ? 'border-emerald-700 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {st.isTrue ? 'Đúng' : 'Sai'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {type === 'short_answer' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Đáp án số chuẩn (tối đa 4 ký tự, VD: 12,3 hoặc -5)
              </label>
              <input
                type="text"
                maxLength={4}
                value={shortAnswer}
                onChange={(e) =>
                  setShortAnswer(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 4))
                }
                placeholder="VD: 88,5"
                className="mt-1 h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Lời giải / Hướng dẫn chấm
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích ngắn gọn để thí sinh xem lại sau khi nộp bài..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Lưu câu hỏi
            </button>
          </div>
        </form>
      </div>

      <AddSubjectModal
        open={quickAddSubjectOpen}
        onClose={() => setQuickAddSubjectOpen(false)}
        onSubjectAdded={(created) => {
          setSubject(created.id);
          setQuickAddSubjectOpen(false);
        }}
      />
    </div>
  );
}
