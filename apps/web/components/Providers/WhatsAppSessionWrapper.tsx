'use client';

import { useAuth } from '../../contexts/AuthContext';
import { WhatsAppSessionProvider } from '../../contexts/WhatsAppSessionContext';
import { ReactNode } from 'react';

export default function WhatsAppSessionWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Determine moderatorId based on user role:
  // - Moderators use their own ID
  // - Regular users use their assigned ModeratorId
  // - Admins don't have WhatsApp sessions (they manage moderators' sessions)
  //   Set to undefined so the context won't poll (admin UI should handle this differently)
  let moderatorId: number | undefined = undefined;
  
  if (user?.id) {
    const userId = parseInt(user.id, 10);
    
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
    }
    // Admins (primary_admin, secondary_admin) get undefined
    // The UI should handle moderator selection separately for admins
  }

  return (
    <WhatsAppSessionProvider moderatorId={moderatorId}>
      {children}
    </WhatsAppSessionProvider>
  );
}
