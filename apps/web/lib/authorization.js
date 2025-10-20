import { useAuth } from './auth'
import { ROLES } from './roles'

export const useAuthorization = () => {
  const { user } = useAuth()

  if (!user) {
    return {
      role: null,
      isPrimaryAdmin: false,
      isSecondaryAdmin: false,
      isModerator: false,
      isUser: false,
      canSeeManagement: false,
      canManageUsers: false,
      canManageQuotas: false,
      canManageWhatsApp: false,
      canManageTemplates: false,
      canCreateQueues: false,
      canViewAllQueues: false,
    }
  }

  const isPrimaryAdmin = user.role === ROLES.PRIMARY_ADMIN
  const isSecondaryAdmin = user.role === ROLES.SECONDARY_ADMIN
  const isModerator = user.role === ROLES.MODERATOR
  const isUser = user.role === ROLES.USER

  // Permissions based on roles
  const canSeeManagement = isPrimaryAdmin || isSecondaryAdmin || isModerator
  const canManageUsers = isPrimaryAdmin
  const canManageQuotas = isPrimaryAdmin
  const canManageWhatsApp = isPrimaryAdmin || isSecondaryAdmin
  const canManageTemplates = isPrimaryAdmin || isSecondaryAdmin
  const canCreateQueues = isModerator || isUser
  const canViewAllQueues = isPrimaryAdmin || isSecondaryAdmin

  return {
    role: user.role,
    isPrimaryAdmin,
    isSecondaryAdmin,
    isModerator,
    isUser,
    canSeeManagement,
    canManageUsers,
    canManageQuotas,
    canManageWhatsApp,
    canManageTemplates,
    canCreateQueues,
    canViewAllQueues,
  }
}

export default useAuthorization
