using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface IChatRequestRepository : IRepository<ChatRequest>
{
    Task<IEnumerable<ChatRequest>> GetUnresolvedAsync();
    Task<int> GetUnresolvedCountAsync();
    Task<IEnumerable<ChatRequest>> GetByAssigneeAsync(string assignedTo);
}
