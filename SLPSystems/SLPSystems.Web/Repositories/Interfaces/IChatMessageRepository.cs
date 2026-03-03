using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface IChatMessageRepository : IRepository<ChatMessage>
{
    Task<IEnumerable<ChatMessage>> GetBySessionIdAsync(string sessionId);
    Task<IEnumerable<string>> GetActiveSessionIdsAsync(int hours = 24);
    Task<int> GetUnreadCountAsync();
    Task MarkSessionReadAsync(string sessionId);
}
