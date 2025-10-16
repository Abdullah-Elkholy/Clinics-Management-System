using System;
using System.Linq;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services
{
    public interface ISessionService
    {
        string CreateRefreshToken(int userId, TimeSpan validFor);
        bool ValidateRefreshToken(Guid sessionId, int userId);
        void RevokeSession(Guid sessionId);
    }

    public class SessionService : ISessionService
    {
        private readonly ApplicationDbContext _db;
        public SessionService(ApplicationDbContext db) { _db = db; }

        public string CreateRefreshToken(int userId, TimeSpan validFor)
        {
            var refresh = Guid.NewGuid();
            var session = new Session {
                Id = refresh,
                UserId = userId,
                RefreshToken = refresh.ToString(),
                ExpiresAt = DateTime.UtcNow.Add(validFor),
                CreatedAt = DateTime.UtcNow
            };
            _db.Sessions.Add(session);
            _db.SaveChanges();
            return session.RefreshToken;
        }

        public bool ValidateRefreshToken(Guid sessionId, int userId)
        {
            var s = _db.Sessions.FirstOrDefault(x => x.Id == sessionId && x.UserId == userId && x.ExpiresAt > DateTime.UtcNow);
            return s != null;
        }

        public void RevokeSession(Guid sessionId)
        {
            var s = _db.Sessions.FirstOrDefault(x => x.Id == sessionId);
            if (s != null) { _db.Sessions.Remove(s); _db.SaveChanges(); }
        }
    }
}
