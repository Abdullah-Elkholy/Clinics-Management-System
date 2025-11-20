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
    } else if (user.role === 'user' && user.moderatorId) {
      // Regular users view their moderator's session
      moderatorId = user.moderatorId;
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
