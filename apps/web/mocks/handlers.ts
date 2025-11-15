/**
 * MSW (Mock Service Worker) Request Handlers
 * 
 * DEFERRED - This file will be used during the testing phase.
 * MSW is not yet installed; handlers will be activated when testing begins.
 * 
 * Defines all mock HTTP endpoints for testing.
 * Includes GET for fetching and POST/PUT/DELETE for mutations.
 */

import { rest, type RestContext, type ResponseComposition } from 'msw';
import { getMockTemplates, getMockConditions } from '@/services/mock/mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// In-memory storage for test mutations (reset between tests)
const mockTemplateStore: Record<number, any[]> = {};
const mockConditionStore: Record<number, any[]> = {};
let nextTemplateId = 100;
let nextConditionId = 200;

const jsonResponse = (
  res: ResponseComposition,
  ctx: RestContext,
  data: unknown,
  status = 200
) => res(ctx.status(status), ctx.json(data));
export const handlers = [
  // Templates collection
  rest.get(`${API_BASE_URL}/templates`, (req, res, ctx) => {
    const queueId = new URL(req.url.toString()).searchParams.get('queueId');
    if (!queueId) {
      return jsonResponse(res, ctx, {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 10,
      });
    }

    const queueIdNum = Number(queueId);
    const templates = mockTemplateStore[queueIdNum] || [];
    return jsonResponse(res, ctx, {
      items: templates,
      totalCount: templates.length,
      pageNumber: 1,
      pageSize: 10,
    });
  }),

  // Template details
  rest.get(`${API_BASE_URL}/templates/:id`, (req, res, ctx) => {
    const templateId = Number(req.params.id as string);
    for (const templates of Object.values(mockTemplateStore)) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        return jsonResponse(res, ctx, template);
      }
    }
    return jsonResponse(res, ctx, { message: 'Template not found' }, 404);
  }),

  // Create template
  rest.post(`${API_BASE_URL}/templates`, async (req, res, ctx) => {
    const { title, content, queueId, isActive = true } = (await req.json()) as any;
    if (!title || !content || !queueId) {
      return jsonResponse(res, ctx, { message: 'Missing required fields' }, 400);
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
    return jsonResponse(res, ctx, newTemplate, 201);
  }),

  // Update template
  rest.put(`${API_BASE_URL}/templates/:id`, async (req, res, ctx) => {
    const templateId = Number(req.params.id as string);
    const { title, content, isActive } = (await req.json()) as any;

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
        return jsonResponse(res, ctx, updated);
      }
    }

    return jsonResponse(res, ctx, { message: 'Template not found' }, 404);
  }),

  // Delete template
  rest.delete(`${API_BASE_URL}/templates/:id`, (req, res, ctx) => {
    const templateId = Number(req.params.id as string);
    for (const queueId in mockTemplateStore) {
      const templates = mockTemplateStore[queueId];
      const index = templates.findIndex((t) => t.id === templateId);
      if (index !== -1) {
        templates.splice(index, 1);
        return jsonResponse(res, ctx, {}, 204);
      }
    }
    return jsonResponse(res, ctx, { message: 'Template not found' }, 404);
  }),

  // Conditions collection
  rest.get(`${API_BASE_URL}/conditions`, (req, res, ctx) => {
    const queueId = new URL(req.url.toString()).searchParams.get('queueId');
    if (!queueId) {
      return jsonResponse(res, ctx, {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 10,
      });
    }

    const queueIdNum = Number(queueId);
    const conditions = mockConditionStore[queueIdNum] || [];
    return jsonResponse(res, ctx, {
      items: conditions,
      totalCount: conditions.length,
      pageNumber: 1,
      pageSize: 10,
    });
  }),

  // Condition details
  rest.get(`${API_BASE_URL}/conditions/:id`, (req, res, ctx) => {
    const conditionId = Number(req.params.id as string);
    for (const conditions of Object.values(mockConditionStore)) {
      const condition = conditions.find((c) => c.id === conditionId);
      if (condition) {
        return jsonResponse(res, ctx, condition);
      }
    }
    return jsonResponse(res, ctx, { message: 'Condition not found' }, 404);
  }),

  // Create condition
  rest.post(`${API_BASE_URL}/conditions`, async (req, res, ctx) => {
    const { templateId, queueId, operator, value, minValue, maxValue } = (await req.json()) as any;
    if (!templateId || !queueId || !operator) {
      return jsonResponse(res, ctx, { message: 'Missing required fields' }, 400);
    }

    const newCondition = {
      id: nextConditionId++,
      templateId,
      queueId,
      operator,
      value,
      minValue,
      maxValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!mockConditionStore[queueId]) {
      mockConditionStore[queueId] = [];
    }
    mockConditionStore[queueId].push(newCondition);
    return jsonResponse(res, ctx, newCondition, 201);
  }),

  // Update condition
  rest.put(`${API_BASE_URL}/conditions/:id`, async (req, res, ctx) => {
    const conditionId = Number(req.params.id as string);
    const { operator, value, minValue, maxValue } = (await req.json()) as any;

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
          updatedAt: new Date().toISOString(),
        };
        conditions[index] = updated;
        return jsonResponse(res, ctx, updated);
      }
    }

    return jsonResponse(res, ctx, { message: 'Condition not found' }, 404);
  }),

  // Delete condition
  rest.delete(`${API_BASE_URL}/conditions/:id`, (req, res, ctx) => {
    const conditionId = Number(req.params.id as string);
    for (const queueId in mockConditionStore) {
      const conditions = mockConditionStore[queueId];
      const index = conditions.findIndex((c) => c.id === conditionId);
      if (index !== -1) {
        conditions.splice(index, 1);
        return jsonResponse(res, ctx, {}, 204);
      }
    }
    return jsonResponse(res, ctx, { message: 'Condition not found' }, 404);
  }),
];
