/**
 * Moderator Quota Management Service
 * Handles quota CRUD operations and calculations
 * Integrates with backend quota endpoints
 */

import { ModeratorQuota } from '@/types/user';
import { messageApiClient, type MyQuotaDto, type QuotaDto } from '@/services/api/messageApiClient';

interface QuotaServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ModeratorQuotaService {
  /**
   * Get quota for current user (authenticated moderator)
   */
  async getMyQuota(): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const quotaDto = await messageApiClient.getMyQuota();
      
      const quota: ModeratorQuota = {
        id: `quota-current`,
        moderatorId: 'current',
        messagesQuota: {
          limit: quotaDto.limit,
          used: quotaDto.used,
          percentage: quotaDto.percentage,
          isLow: quotaDto.isLowQuota,
          warningThreshold: 80,
        },
        queuesQuota: {
          limit: quotaDto.queuesLimit,
          used: quotaDto.queuesUsed,
          percentage: Math.round((quotaDto.queuesUsed / quotaDto.queuesLimit) * 100),
          isLow: (quotaDto.queuesUsed / quotaDto.queuesLimit) >= 0.8,
          warningThreshold: 80,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { success: true, data: quota };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get quota for a specific moderator (admin only)
   */
  async getQuota(moderatorId: string): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const quotaDto = await messageApiClient.getQuota(parseInt(moderatorId));
      
      const quota: ModeratorQuota = {
        id: `quota-${moderatorId}`,
        moderatorId,
        messagesQuota: {
          limit: quotaDto.limit,
          used: quotaDto.used,
          percentage: quotaDto.percentage,
          isLow: quotaDto.isLow,
          warningThreshold: 80,
        },
        queuesQuota: {
          limit: quotaDto.queuesLimit,
          used: quotaDto.queuesUsed,
          percentage: Math.round((quotaDto.queuesUsed / quotaDto.queuesLimit) * 100),
          isLow: (quotaDto.queuesUsed / quotaDto.queuesLimit) >= 0.8,
          warningThreshold: 80,
        },
        createdAt: new Date(),
        updatedAt: new Date(quotaDto.updatedAt),
      };

      return { success: true, data: quota };
    } catch (error: any) {
      // Handle 405 Method Not Allowed and other errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Extract statusCode from various error shapes
      const statusCode = error?.statusCode || error?.status || (error?.message?.includes('405') ? 405 : undefined) || (error?.message?.includes('403') ? 403 : undefined);
      
      // If it's a 405 or 403, return default quota instead of error
      if (statusCode === 405 || statusCode === 403 || errorMessage?.includes('405') || errorMessage?.includes('403') || errorMessage?.includes('Method Not Allowed') || errorMessage?.includes('Forbidden')) {
        // Return default unlimited quota for non-admin users or when endpoint is not available
        const defaultQuota: ModeratorQuota = {
          id: `quota-${moderatorId}`,
          moderatorId,
          messagesQuota: {
            limit: -1,
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          queuesQuota: {
            limit: -1,
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return { success: true, data: defaultQuota };
      }
      
      return {
        success: false,
        error: `Failed to fetch quota: ${errorMessage}`,
      };
    }
  }

  /**
   * Update quota for a moderator (via backend API)
   */
  async updateQuota(
    moderatorId: string,
    updates: Partial<ModeratorQuota>,
    mode: 'set' | 'add' = 'set'
  ): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      if (mode === 'add') {
        await messageApiClient.addQuota(parseInt(moderatorId), {
          limit: updates.messagesQuota?.limit || 0,
          queuesLimit: updates.queuesQuota?.limit || 0,
        });
      } else {
        // Build payload with only defined values that are >= 1
        const payload: { limit?: number; queuesLimit?: number } = {};
        if (updates.messagesQuota?.limit !== undefined && updates.messagesQuota.limit >= 1) {
          payload.limit = updates.messagesQuota.limit;
        }
        if (updates.queuesQuota?.limit !== undefined && updates.queuesQuota.limit >= 1) {
          payload.queuesLimit = updates.queuesQuota.limit;
        }
        
        if (Object.keys(payload).length === 0) {
          return {
            success: false,
            error: 'الحد الأدنى يجب أن يكون 1 أو أكثر',
          };
        }
        
        await messageApiClient.updateQuota(parseInt(moderatorId), payload);
      }
      
      return this.getQuota(moderatorId);
    } catch (error) {
      return {
        success: false,
        error: `Failed to update quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add usage to a moderator's quota
   */
  async addUsage(
    moderatorId: string,
    type: 'messages' | 'queues',
    amount: number
  ): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const quotaResult = await this.getQuota(moderatorId);
      if (!quotaResult.success || !quotaResult.data) {
        return quotaResult;
      }

      const quota = quotaResult.data;
      const quotaType = type === 'messages' ? quota.messagesQuota : quota.queuesQuota;

      // Update with new usage value
      const updates: Partial<ModeratorQuota> = {};
      if (type === 'messages') {
        updates.messagesQuota = {
          ...quotaType,
          used: quotaType.used + amount,
        };
      } else {
        updates.queuesQuota = {
          ...quotaType,
          used: quotaType.used + amount,
        };
      }

      return this.updateQuota(moderatorId, updates, 'set');
    } catch (error) {
      return {
        success: false,
        error: `Failed to add usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if moderator can perform action
   */
  async canPerformAction(
    moderatorId: string,
    type: 'messages' | 'queues'
  ): Promise<boolean> {
    try {
      const quotaResult = await this.getQuota(moderatorId);
      if (!quotaResult.success || !quotaResult.data) {
        return false;
      }

      const quota = quotaResult.data;
      const quotaType =
        type === 'messages' ? quota.messagesQuota : quota.queuesQuota;

      if (quotaType.limit === -1) {
        return true;
      }

      return quotaType.used < quotaType.limit;
    } catch {
      return false;
    }
  }

  /**
   * Get all quotas (admin only)
   */
  async getAllQuotas(): Promise<QuotaServiceResponse<ModeratorQuota[]>> {
    try {
      const response = await messageApiClient.getAllQuotas();
      
      if (response.items && response.items.length > 0) {
        const quotas: ModeratorQuota[] = response.items.map((dto: QuotaDto, idx: number) => ({
          id: `quota-${idx}`,
          moderatorId: dto.id.toString(),
          messagesQuota: {
            limit: dto.limit,
            used: dto.used,
            percentage: dto.percentage,
            isLow: dto.isLow,
            warningThreshold: 80,
          },
          queuesQuota: {
            limit: dto.queuesLimit,
            used: dto.queuesUsed,
            percentage: Math.round((dto.queuesUsed / dto.queuesLimit) * 100),
            isLow: (dto.queuesUsed / dto.queuesLimit) >= 0.8,
            warningThreshold: 80,
          },
          createdAt: new Date(),
          updatedAt: new Date(dto.updatedAt),
        }));
        return { success: true, data: quotas };
      }

      return { success: true, data: [] };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch quotas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const moderatorQuotaService = new ModeratorQuotaService();
export default moderatorQuotaService;
