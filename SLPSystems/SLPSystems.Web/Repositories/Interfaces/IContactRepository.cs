using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface IContactRepository : IRepository<ContactMessage>
{
    Task<int> GetUnreadCountAsync();
    Task MarkAsReadAsync(int id);
}
