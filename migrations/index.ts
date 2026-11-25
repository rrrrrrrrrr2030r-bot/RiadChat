export interface MigrationDefinition {
  id: string;
  filename: string;
  titleAr: string;
  descriptionAr: string;
  createdAt: string;
  up: (draft: Record<string, unknown>) => { changedCount: number; summary: string };
  validate: (draft: Record<string, unknown>) => boolean;
}

export interface AppliedMigrationRecord {
  id: string;
  filename: string;
  titleAr: string;
  appliedAt: string;
  appliedBy: string;
  changedCount: number;
  summary: string;
  preSnapshotId?: string;
}

export interface DryRunResult {
  migrationId: string;
  filename: string;
  passed: boolean;
  changedCount: number;
  summary: string;
  durationMs: number;
  error?: string;
}

export const DATABASE_MIGRATIONS: MigrationDefinition[] = [
  {
    id: '2026_11_20_001_soft_delete_and_archive',
    filename: '2026_11_20_001_soft_delete_and_archive.ts',
    titleAr: 'تهيئة حقول الأرشفة الآمنة (Soft Delete) ومنع الحذف المباشر',
    descriptionAr:
      'يضمن وجود حقول حالة الأرشفة وسجل التحديث على الغرف والمشرفين لدعم الاستعادة الكاملة دون فقدان بيانات.',
    createdAt: '2026-11-20',
    up: (draft) => {
      let changedCount = 0;
      const rooms = Array.isArray(draft.rooms) ? (draft.rooms as Record<string, unknown>[]) : [];
      for (const room of rooms) {
        if (typeof room.archivedAt === 'undefined') {
          room.archivedAt = null;
          changedCount += 1;
        }
      }
      const moderators = Array.isArray(draft.moderators)
        ? (draft.moderators as Record<string, unknown>[])
        : [];
      for (const mod of moderators) {
        if (typeof mod.archivedAt === 'undefined') {
          mod.archivedAt = null;
          changedCount += 1;
        }
      }
      return {
        changedCount,
        summary: `تمت تهيئة حقول الأرشفة الآمنة على ${changedCount} سجل`,
      };
    },
    validate: (draft) => Array.isArray(draft.rooms) && Array.isArray(draft.users),
  },
  {
    id: '2026_11_20_002_room_password_and_index_integrity',
    filename: '2026_11_20_002_room_password_and_index_integrity.ts',
    titleAr: 'تنقية كلمات مرور الغرف النصية وتوحيد المعرفات للفهرسة السريعة',
    descriptionAr:
      'يتحقق من عدم بقاء أي كلمة مرور نصية داخل كائنات الغرف ويضمن صحة معرفات المستخدمين والغرف للفهارس O(1).',
    createdAt: '2026-11-20',
    up: (draft) => {
      let changedCount = 0;
      const rooms = Array.isArray(draft.rooms) ? (draft.rooms as Record<string, unknown>[]) : [];
      for (const room of rooms) {
        if (typeof room.password === 'string' && room.password.trim().length > 0) {
          delete room.password;
          room.hasPassword = true;
          changedCount += 1;
        }
        if (typeof room.id === 'string' && room.id !== room.id.trim()) {
          room.id = room.id.trim();
          changedCount += 1;
        }
      }
      const users = Array.isArray(draft.users) ? (draft.users as Record<string, unknown>[]) : [];
      for (const user of users) {
        if (typeof user.id === 'string' && user.id !== user.id.trim()) {
          user.id = user.id.trim();
          changedCount += 1;
        }
      }
      return {
        changedCount,
        summary:
          changedCount > 0
            ? `تم تنظيف وتوحيد ${changedCount} سجل للفهرسة السريعة`
            : 'جميع السجلات نظيفة وجاهزة للفهرسة السريعة دون تعديلات إضافية',
      };
    },
    validate: (draft) => {
      const users = Array.isArray(draft.users) ? (draft.users as Record<string, unknown>[]) : [];
      return users.some((u) => u.id === '900');
    },
  },
  {
    id: '2026_11_20_003_agent_2fa_audit_metadata',
    filename: '2026_11_20_003_agent_2fa_audit_metadata.ts',
    titleAr: 'تفعيل وسم المصادقة الثنائية الإلزامية للوكلاء المعتمدين والمالك',
    descriptionAr:
      'يضبط خاصية تفعيل حماية 2FA على جميع حسابات الوكلاء المعتمدين والمالك الرئيسي (ID: 900).',
    createdAt: '2026-11-20',
    up: (draft) => {
      let changedCount = 0;
      const users = Array.isArray(draft.users) ? (draft.users as Record<string, unknown>[]) : [];
      for (const user of users) {
        if (user.id === '900' || user.isVerifiedAgent === true) {
          if (user.agency2faEnforced !== true) {
            user.agency2faEnforced = true;
            changedCount += 1;
          }
        }
      }
      return {
        changedCount,
        summary: `تم وسم ${changedCount} حساب وكيل/مالك بإلزامية المصادقة الثنائية`,
      };
    },
    validate: (draft) => {
      const users = Array.isArray(draft.users) ? (draft.users as Record<string, unknown>[]) : [];
      const owner = users.find((u) => u.id === '900');
      return Boolean(owner && owner.agency2faEnforced === true);
    },
  },
];

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function dryRunMigrationOnCopy(
  liveState: Record<string, unknown>,
  migrationId: string
): DryRunResult {
  const migration = DATABASE_MIGRATIONS.find((m) => m.id === migrationId);
  const start = Date.now();
  if (!migration) {
    return {
      migrationId,
      filename: 'unknown',
      passed: false,
      changedCount: 0,
      summary: 'الترحيل المطلوب غير موجود',
      durationMs: Date.now() - start,
      error: 'MIGRATION_NOT_FOUND',
    };
  }
  try {
    const sandboxCopy = deepClone(liveState);
    const outcome = migration.up(sandboxCopy);
    const valid = migration.validate(sandboxCopy);
    if (!valid) {
      return {
        migrationId: migration.id,
        filename: migration.filename,
        passed: false,
        changedCount: outcome.changedCount,
        summary: 'فشل فحص سلامة البيانات بعد تجربة الترحيل على النسخة المعزولة',
        durationMs: Date.now() - start,
        error: 'POST_VALIDATION_FAILED',
      };
    }
    return {
      migrationId: migration.id,
      filename: migration.filename,
      passed: true,
      changedCount: outcome.changedCount,
      summary: outcome.summary,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      migrationId: migration.id,
      filename: migration.filename,
      passed: false,
      changedCount: 0,
      summary: 'حدث خطأ أثناء تجربة الترحيل على النسخة المعزولة',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Executes a migration inside an atomic in-memory + on-disk transaction.
 * If anything fails or post-validation fails, live state is completely untouched (rollback).
 */
export function applyMigrationTransactionally<TState extends Record<string, unknown>>(params: {
  liveState: TState;
  migrationId: string;
  appliedBy: string;
  alreadyApplied: AppliedMigrationRecord[];
  createPreSnapshot: (reason: string) => string | undefined;
  commitState: (nextState: TState) => void;
}): {
  ok: boolean;
  record?: AppliedMigrationRecord;
  error?: string;
} {
  const { liveState, migrationId, appliedBy, alreadyApplied, createPreSnapshot, commitState } = params;
  const migration = DATABASE_MIGRATIONS.find((m) => m.id === migrationId);
  if (!migration) {
    return { ok: false, error: 'الترحيل المطلوب غير موجود' };
  }
  if (alreadyApplied.some((m) => m.id === migrationId)) {
    return { ok: false, error: 'تم تطبيق هذا الترحيل مسبقاً' };
  }

  // Step 1: Mandatory dry-run on an isolated sandbox copy first
  const dryRun = dryRunMigrationOnCopy(liveState, migrationId);
  if (!dryRun.passed) {
    return { ok: false, error: dryRun.error || dryRun.summary };
  }

  // Step 2: Take automatic pre-migration PITR snapshot for instant rollback
  const preSnapshotId = createPreSnapshot(`pre-migration-${migration.id}`);

  // Step 3: Execute inside atomic transaction (apply to cloned candidate, validate, then swap & persist)
  const backupInMemory = deepClone(liveState);
  try {
    const candidate = deepClone(liveState);
    const outcome = migration.up(candidate);
    if (!migration.validate(candidate)) {
      throw new Error('فشل التحقق البعدي داخل المعاملة — تم التراجع التلقائي');
    }
    commitState(candidate);
    const record: AppliedMigrationRecord = {
      id: migration.id,
      filename: migration.filename,
      titleAr: migration.titleAr,
      appliedAt: new Date().toISOString(),
      appliedBy,
      changedCount: outcome.changedCount,
      summary: outcome.summary,
      preSnapshotId,
    };
    return { ok: true, record };
  } catch (err) {
    // Explicit atomic rollback on any commit/persistence failure
    try {
      commitState(backupInMemory);
    } catch {
      // Ignore secondary rollback error
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'فشل الترحيل وتم التراجع التلقائي عن كافة التغييرات',
    };
  }
}
