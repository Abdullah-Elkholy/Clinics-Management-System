/**
 * MSW (Mock Service Worker) Request Handlers
 * 
 * DEFERRED - This file will be used during the testing phase.
 * MSW is not yet installed; handlers will be activated when testing begins.
 * 
 * Defines all mock HTTP endpoints for testing.
 * Includes GET for fetching and POST/PUT/DELETE for mutations.
 */

// @ts-nocheck - Disable type checking for deferred MSW integration
import { http, HttpResponse } from 'msw';
import { getMockTemplates, getMockConditions, createMockTemplate, createMockCondition } from '@/services/mock/mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// In-memory storage for test mutations (reset between tests)
let mockTemplateStore: Record<number, any[]> = {};
let mockConditionStore: Record<number, any[]> = {};
let nextTemplateId = 100;
let nextConditionId = 1000;

/**
 * Initialize mock stores from fixtures
 */
function initializeMockStores() {
  mockTemplateStore = {
    1: getMockTemplates(1),
    2: getMockTemplates(2),
    3: getMockTemplates(3),
  };
  mockConditionStore = {
    1: getMockConditions(1),
    2: getMockConditions(2),
    3: getMockConditions(3),
  };
}

/**
 * Reset mock data (called before each test)
 */
export function resetMockData() {
  initializeMockStores();
  nextTemplateId = 100;
  nextConditionId = 1000;
}

// Initialize on import
initializeMockStores();

export const handlers = [
  // ============================================
  // Templates Endpoints
  // ============================================

  // GET /api/templates - List templates for a queue
  http.get(`${API_BASE_URL}/templates`, ({ request }) => {
    const url = new URL(request.url);
    const queueId = url.searchParams.get('queueId');

    if (!queueId) {
      return HttpResponse.json({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 10,
      });
    }

    const queueIdNum = Number(queueId);
    const templates = mockTemplateStore[queueIdNum] || [];

    return HttpResponse.json({
      items: templates,
      totalCount: templates.length,
      pageNumber: 1,
      pageSize: 10,
    });
  }),

  // GET /api/templates/:id - Get a specific template
  http.get(`${API_BASE_URL}/templates/:id`, ({ params }) => {
    const { id } = params;
    const templateId = Number(id);

    for (const templates of Object.values(mockTemplateStore)) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        return HttpResponse.json(template);
      }
    }

    return HttpResponse.json(
      { message: 'Template not found' },
      { status: 404 }
    );
  }),

  // POST /api/templates - Create a new template
  http.post(`${API_BASE_URL}/templates`, async ({ request }) => {
    const body = await request.json() as any;
    const { title, content, queueId, isActive = true } = body;

    if (!title || !content || !queueId) {
      return HttpResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newTemplate = {
      id: nextTemplateId++,
      title,
      content,
      queueId,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!mockTemplateStore[queueId]) {
      mockTemplateStore[queueId] = [];
    }
    mockTemplateStore[queueId].push(newTemplate);

    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  // PUT /api/templates/:id - Update a template
  http.put(`${API_BASE_URL}/templates/:id`, async ({ params, request }) => {
    const { id } = params;
    const templateId = Number(id);
    const body = await request.json() as any;
    const { title, content, isActive } = body;

    for (const queueId in mockTemplateStore) {
      const templates = mockTemplateStore[queueId];
      const index = templates.findIndex((t) => t.id === templateId);
      if (index !== -1) {
        const updated = {
          ...templates[index],
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date().toISOString(),
        };
        templates[index] = updated;
        return HttpResponse.json(updated);
      }
    }

    return HttpResponse.json(
      { message: 'Template not found' },
      { status: 404 }
    );
  }),

  // DELETE /api/templates/:id - Delete a template
  http.delete(`${API_BASE_URL}/templates/:id`, ({ params }) => {
    const { id } = params;
    const templateId = Number(id);

    for (const queueId in mockTemplateStore) {
      const templates = mockTemplateStore[queueId];
      const index = templates.findIndex((t) => t.id === templateId);
      if (index !== -1) {
        templates.splice(index, 1);
        return HttpResponse.json({}, { status: 204 });
      }
    }

    return HttpResponse.json(
      { message: 'Template not found' },
      { status: 404 }
    );
  }),

  // ============================================
  // Conditions Endpoints
  // ============================================

  // GET /api/conditions - List conditions for a queue
  http.get(`${API_BASE_URL}/conditions`, ({ request }) => {
    const url = new URL(request.url);
    const queueId = url.searchParams.get('queueId');

    if (!queueId) {
      return HttpResponse.json({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 10,
      });
    }

    const queueIdNum = Number(queueId);
    const conditions = mockConditionStore[queueIdNum] || [];

    return HttpResponse.json({
      items: conditions,
      totalCount: conditions.length,
      pageNumber: 1,
      pageSize: 10,
    });
  }),

  // GET /api/conditions/:id - Get a specific condition
  http.get(`${API_BASE_URL}/conditions/:id`, ({ params }) => {
    const { id } = params;
    const conditionId = Number(id);

    for (const conditions of Object.values(mockConditionStore)) {
      const condition = conditions.find((c) => c.id === conditionId);
      if (condition) {
        return HttpResponse.json(condition);
      }
    }

    return HttpResponse.json(
      { message: 'Condition not found' },
      { status: 404 }
    );
  }),

  // POST /api/conditions - Create a new condition
  http.post(`${API_BASE_URL}/conditions`, async ({ request }) => {
    const body = await request.json() as any;
    const { templateId, operator, value, minValue, maxValue } = body;

    if (!templateId || !operator) {
      return HttpResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newCondition = {
      id: nextConditionId++,
      templateId,
      operator,
      value,
      minValue,
      maxValue,
      createdAt: new Date().toISOString(),
    };

    // Store under first queue for simplicity (templates could be in any queue)
    const firstQueueId = Object.keys(mockConditionStore)[0];
    if (firstQueueId && !mockConditionStore[Number(firstQueueId)]) {
      mockConditionStore[Number(firstQueueId)] = [];
    }
    if (firstQueueId) {
      mockConditionStore[Number(firstQueueId)].push(newCondition);
    }

    return HttpResponse.json(newCondition, { status: 201 });
  }),

  // PUT /api/conditions/:id - Update a condition
  http.put(`${API_BASE_URL}/conditions/:id`, async ({ params, request }) => {
    const { id } = params;
    const conditionId = Number(id);
    const body = await request.json() as any;
    const { operator, value, minValue, maxValue } = body;

    for (const queueId in mockConditionStore) {
      const conditions = mockConditionStore[queueId];
      const index = conditions.findIndex((c) => c.id === conditionId);
      if (index !== -1) {
        const updated = {
          ...conditions[index],
          ...(operator !== undefined && { operator }),
          ...(value !== undefined && { value }),
          ...(minValue !== undefined && { minValue }),
          ...(maxValue !== undefined && { maxValue }),
        };
        conditions[index] = updated;
        return HttpResponse.json(updated);
      }
    }

    return HttpResponse.json(
      { message: 'Condition not found' },
      { status: 404 }
    );
  }),

  // DELETE /api/conditions/:id - Delete a condition
  http.delete(`${API_BASE_URL}/conditions/:id`, ({ params }) => {
    const { id } = params;
    const conditionId = Number(id);

    for (const queueId in mockConditionStore) {
      const conditions = mockConditionStore[queueId];
      const index = conditions.findIndex((c) => c.id === conditionId);
      if (index !== -1) {
        conditions.splice(index, 1);
        return HttpResponse.json({}, { status: 204 });
      }
    }

    return HttpResponse.json(
      { message: 'Condition not found' },
      { status: 404 }
    );
  }),
];
