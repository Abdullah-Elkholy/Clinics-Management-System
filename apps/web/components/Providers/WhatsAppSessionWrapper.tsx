'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useQueue } from '../../contexts/QueueContext';
import { WhatsAppSessionProvider } from '../../contexts/WhatsAppSessionContext';
import { ReactNode } from 'react';

export default function WhatsAppSessionWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { selectedModeratorId } = useQueue();

  // Determine moderatorId based on user role:
  // - Moderators use their own ID
  // - Regular users use their assigned ModeratorId
  // - Admins use the selectedModeratorId from QueueContext (the moderator they're viewing)
  let moderatorId: number | undefined = undefined;

  if (user?.id) {
    const userId = parseInt(user.id, 10);
    const isAdmin = user.role === 'primary_admin' || user.role === 'secondary_admin';

    if (user.role === 'moderator') {
      // Moderators use their own ID
      moderatorId = userId;
    } else if (user.role === 'user') {
      // Regular users view their moderator's session
      // Use assignedModerator field (not moderatorId)
      const assignedModId = user.assignedModerator;
      if (assignedModId) {
        moderatorId = parseInt(assignedModId, 10);
        // Validate the parsed ID
        if (isNaN(moderatorId)) {
          moderatorId = undefined;
        }
      }
    } else if (isAdmin && selectedModeratorId) {
      // Admins use the selected moderator from the queue context
      moderatorId = selectedModeratorId;
    }
  }

  return (
    <WhatsAppSessionProvider moderatorId={moderatorId}>
      {children}
    </WhatsAppSessionProvider>
  );
}
