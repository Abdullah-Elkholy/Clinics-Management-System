import { rest } from 'msw';

// Test data builders and in-memory DB
const nowIso = () => new Date().toISOString();

type TemplateRow = {
  id: number;
  title: string;
  content: string;
  queueId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConditionRow = {
  id: number;
  templateId?: number;
  queueId: number;
  operator: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  createdAt: string;
  updatedAt?: string;
};

type FailedTaskRow = {
  id: number;
  messageId: string; // Changed from number to string (Guid)
  queueId: number;
  queueName: string;
  patientPhone: string;
  messageContent: string;
  attempts: number;
  errorMessage?: string;
  status: string;
  createdAt: string;
  lastAttemptAt?: string;
};

type QueueRow = {
  id: number;
  doctorName: string;
  createdBy: number;
  moderatorId: number;
  currentPosition: number;
  estimatedWaitMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

const createDb = () => ({
  templates: new Map<number, TemplateRow[]>([
    [123, [
      {
        id: 1001,
        title: 'Template A',
        content: 'Hello {PN}',
        queueId: 123,
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]],
    [456, []], // initially empty for integration mutation tests
  ]),
  conditions: new Map<number, ConditionRow[]>([
    [123, [
      {
        id: 2001,
        templateId: 1001,
        queueId: 123,
        operator: 'UNCONDITIONED',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]],
    [456, []],
  ]),
  nextTemplateId: 1002,
  nextConditionId: 2002,
  patients: new Map<number, Array<{ id: number; fullName: string; phoneNumber: string; position: number; status: string }>>([
    [789, [
      { id: 1, fullName: 'Ali Hassan', phoneNumber: '+201001001000', position: 1, status: 'waiting' },
      { id: 2, fullName: 'Mona Ahmed', phoneNumber: '+201002002000', position: 2, status: 'waiting' },
    ]],
  ]),
  nextPatientId: 3,
  failedTasks: [
    {
      id: 501,
      messageId: '501',
      queueId: 10,
      queueName: 'Dr One',
      patientPhone: '+201001234567',
      messageContent: 'Hello, please call us',
      attempts: 2,
      errorMessage: 'Network error: connection timeout',
      status: 'failed',
      createdAt: nowIso(),
      lastAttemptAt: nowIso(),
    },
    {
      id: 502,
      messageId: '502',
      queueId: 11,
      queueName: 'Dr Two',
      patientPhone: '+201009876543',
      messageContent: 'Your appointment is confirmed',
      attempts: 1,
      errorMessage: 'Invalid phone number format',
      status: 'failed',
      createdAt: nowIso(),
      lastAttemptAt: nowIso(),
    },
  ] as FailedTaskRow[],
  nextFailedTaskId: 503,
  queues: [
    {
      id: 10,
      doctorName: 'Dr One',
      createdBy: 100,
      moderatorId: 100,
      currentPosition: 3,
      estimatedWaitMinutes: 15,
      isActive: true,
      createdAt: nowIso(),
    } as QueueRow,
    {
      id: 11,
      doctorName: 'Dr Two',
      createdBy: 101,
      moderatorId: 101,
      currentPosition: 5,
      estimatedWaitMinutes: 20,
      isActive: true,
      createdAt: nowIso(),
    } as QueueRow,
  ] as QueueRow[],
  nextQueueId: 12,
});

let db = createDb();

export const resetDb = () => {
  db = createDb();
};

export const handlers = [
  // Auth login: returns a simple JWT with role/user info
  rest.post('http://localhost:5000/api/auth/login', async (_req, res, ctx) => {
    // Very small JWT with base64url payload { sub: '1', name: 'tester', role: 'user' }
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const payload = btoa(
      JSON.stringify({ sub: '1', name: 'tester', role: 'user', firstName: 'Test', lastName: 'User' })
    )
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const token = `${header}.${payload}.signature`;

    return res(ctx.status(200), ctx.json({ success: true, data: { accessToken: token } }));
  }),

  // Queues list
  rest.get('http://localhost:5000/api/queues', async (_req, res, ctx) => {
    const items = [...db.queues].sort((a, b) => a.id - b.id);
    return res(ctx.status(200), ctx.json({ items, totalCount: items.length, pageNumber: 1, pageSize: 50 }));
  }),

  // Create queue
  rest.post('http://localhost:5000/api/queues', async (req, res, ctx) => {
    const body = (req as any).body || {};
    const row: QueueRow = {
      id: db.nextQueueId++,
      doctorName: body.doctorName ?? 'Dr New',
      createdBy: body.createdBy ?? 100,
      moderatorId: body.moderatorId ?? 100,
      currentPosition: body.currentPosition ?? 0,
      estimatedWaitMinutes: body.estimatedWaitMinutes ?? 10,
      isActive: body.isActive ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.queues.push(row);
    return res(ctx.status(200), ctx.json(row));
  }),

  // Update queue
  rest.put('http://localhost:5000/api/queues/:id', async (req, res, ctx) => {
    const id = Number((req.params as any).id);
    const body = (req as any).body || {};
    const idx = db.queues.findIndex(q => q.id === id);
    if (idx === -1) return res(ctx.status(404), ctx.json({ message: 'Not found' }));
    db.queues[idx] = { ...db.queues[idx], ...body, updatedAt: nowIso() } as QueueRow;
    return res(ctx.status(200), ctx.json(db.queues[idx]));
  }),

  // Delete queue
  rest.delete('http://localhost:5000/api/queues/:id', async (req, res, ctx) => {
    const id = Number((req.params as any).id);
    const idx = db.queues.findIndex(q => q.id === id);
    if (idx === -1) return res(ctx.status(404), ctx.json({ message: 'Not found' }));
    db.queues.splice(idx, 1);
    return res(ctx.status(200));
  }),

  // Templates by queueId
  rest.get('http://localhost:5000/api/templates', async (req, res, ctx) => {
    const url = new URL(req.url.toString());
    const queueId = Number(url.searchParams.get('queueId') || '0');
    const items = db.templates.get(queueId) ?? [];
    return res(
      ctx.status(200),
      ctx.json({ items, totalCount: items.length, pageNumber: 1, pageSize: 50 })
    );
  }),

  // Create template
  rest.post('http://localhost:5000/api/templates', async (req, res, ctx) => {
    const body = (req as any).body || {};
    const title = body.title ?? 'Untitled';
    const content = body.content ?? '';
    const queueId = Number(body.queueId ?? 0);
    const isActive = body.isActive ?? true;
    const newRow: TemplateRow = {
      id: db.nextTemplateId++,
      title,
      content,
      queueId,
      isActive,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const list = db.templates.get(queueId) ?? [];
    list.push(newRow);
    db.templates.set(queueId, list);
    return res(ctx.status(200), ctx.json(newRow));
  }),

  // Conditions by queueId
  rest.get('http://localhost:5000/api/conditions', async (req, res, ctx) => {
    const url = new URL(req.url.toString());
    const queueId = Number(url.searchParams.get('queueId') || '0');
    const items = db.conditions.get(queueId) ?? [];
    return res(
      ctx.status(200),
      ctx.json({ items, totalCount: items.length, pageNumber: 1, pageSize: 50 })
    );
  }),

  // Patients by queueId
  rest.get('http://localhost:5000/api/patients', async (req, res, ctx) => {
    const url = new URL(req.url.toString());
    const queueId = Number(url.searchParams.get('queueId') || '0');
    const items = db.patients.get(queueId) ?? [];
    return res(ctx.status(200), ctx.json({ items, totalCount: items.length, pageNumber: 1, pageSize: 50 }));
  }),

  // Create patient
  rest.post('http://localhost:5000/api/patients', async (req, res, ctx) => {
    const body = (req as any).body || {};
    const queueId = Number(body.queueId ?? 0);
    const fullName = body.fullName ?? 'New Patient';
    const phoneNumber = body.phoneNumber ?? '+201000000000';
    const position = body.position ?? ((db.patients.get(queueId)?.slice(-1)[0]?.position ?? 0) + 1);
    const newRow = { id: db.nextPatientId++, fullName, phoneNumber, position, status: 'waiting' };
    const list = db.patients.get(queueId) ?? [];
    list.push(newRow);
    db.patients.set(queueId, list);
    return res(ctx.status(200), ctx.json(newRow));
  }),

  // Update patient
  rest.put('http://localhost:5000/api/patients/:id', async (req, res, ctx) => {
    const id = Number((req.params as any).id);
    const body = (req as any).body || {};
    // Find patient across all queues
    for (const [queueId, items] of db.patients.entries()) {
      const idx = items.findIndex(p => p.id === id);
      if (idx >= 0) {
        const updated = { ...items[idx], ...body };
        items[idx] = updated;
        db.patients.set(queueId, items);
        return res(ctx.status(200), ctx.json(updated));
      }
    }
    return res(ctx.status(404), ctx.json({ message: 'Not found' }));
  }),

  // Delete patient
  rest.delete('http://localhost:5000/api/patients/:id', async (req, res, ctx) => {
    const id = Number((req.params as any).id);
    for (const [queueId, items] of db.patients.entries()) {
      const idx = items.findIndex(p => p.id === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        // Normalize positions after delete
        items.sort((a, b) => a.position - b.position).forEach((p, i) => (p.position = i + 1));
        db.patients.set(queueId, items);
        return res(ctx.status(200));
      }
    }
    return res(ctx.status(404), ctx.json({ message: 'Not found' }));
  }),

  // Reorder patients
  rest.post('http://localhost:5000/api/patients/reorder', async (req, res, ctx) => {
    const body = (req as any).body || {};
    const queueId = Number(body.queueId ?? 0);
    const items = (body.items ?? []) as Array<{ id: number; position: number }>;
    const list = db.patients.get(queueId) ?? [];
    for (const { id, position } of items) {
      const found = list.find(p => p.id === id);
      if (found) found.position = position;
    }
    // normalize positions: sort by position then reindex 1..n
    list.sort((a, b) => a.position - b.position).forEach((p, i) => (p.position = i + 1));
    db.patients.set(queueId, list);
    return res(ctx.status(200));
  }),

  // Get failed tasks with pagination
  rest.get('http://localhost:5000/api/failed-tasks', async (req, res, ctx) => {
    const url = new URL(req.url);
    const pageNumber = parseInt(url.searchParams.get('pageNumber') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const queueId = url.searchParams.get('queueId');

    let filtered = db.failedTasks as any[];
    if (queueId) {
      filtered = filtered.filter(t => t.queueId === parseInt(queueId));
    }

    const totalCount = filtered.length;
    const start = (pageNumber - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return res(
      ctx.status(200),
      ctx.json({
        items,
        totalCount,
        pageNumber,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: start + pageSize < totalCount,
        hasPreviousPage: pageNumber > 1,
      })
    );
  }),

  // Get a single failed task
  rest.get('http://localhost:5000/api/failed-tasks/:id', async (req, res, ctx) => {
    const id = parseInt(req.params.id as string);
    const task = db.failedTasks.find((t: FailedTaskRow) => t.id === id);
    if (!task) {
      return res(ctx.status(404), ctx.json({ message: 'Not found' }));
    }
    return res(ctx.status(200), ctx.json(task));
  }),

  // Retry a failed task
  rest.post('http://localhost:5000/api/failed-tasks/:id/retry', async (req, res, ctx) => {
    const id = parseInt(req.params.id as string);
    const taskIndex = db.failedTasks.findIndex((t: FailedTaskRow) => t.id === id);
    if (taskIndex < 0) {
      return res(ctx.status(404), ctx.json({ message: 'Task not found' }));
    }
    
    const task = db.failedTasks[taskIndex];
    // Update task: increment attempts, reset error, set status to pending
    task.attempts = (task.attempts || 0) + 1;
    task.status = 'pending';
    task.errorMessage = undefined;
    task.lastAttemptAt = nowIso();

    db.failedTasks[taskIndex] = task;
    return res(ctx.status(200), ctx.json(task));
  }),

  // Dismiss a failed task
  rest.post('http://localhost:5000/api/failed-tasks/:id/dismiss', async (req, res, ctx) => {
    const id = parseInt(req.params.id as string);
    const taskIndex = db.failedTasks.findIndex((t: FailedTaskRow) => t.id === id);
    if (taskIndex < 0) {
      return res(ctx.status(404), ctx.json({ message: 'Task not found' }));
    }
    
    db.failedTasks.splice(taskIndex, 1);
    return res(ctx.status(200));
  }),

  // Send a message
  rest.post('http://localhost:5000/api/messages', async (req, res, ctx) => {
    const body = (req as any).body || {};
    const messageId = 10001 + Math.floor(Math.random() * 1000);
    
    return res(
      ctx.status(200),
      ctx.json({
        id: messageId,
        status: 'sent',
        templateId: body.templateId,
        queueId: body.queueId,
        patientPhone: body.patientPhone,
      })
    );
  }),

  // Retry a message
  rest.post('http://localhost:5000/api/messages/:id/retry', async (req, res, ctx) => {
    const messageId = parseInt(req.params.id as string);
    return res(
      ctx.status(200),
      ctx.json({
        id: messageId,
        status: 'pending',
        attempts: 2,
      })
    );
  }),

];

// Fallback: prevent unexpected network errors in tests
export const defaultFallbackHandler = rest.all('*', async (_req, res, ctx) => {
  return res(ctx.status(200), ctx.json({ success: true, data: {} }));
});

/**
 * Reset in-memory mock data to initial state between tests
 */
export function resetMockData() {
  // Reinitialize the in-memory database to its default seeded state
  resetDb();
}
