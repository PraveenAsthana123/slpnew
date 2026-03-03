using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface IVideoDemoRepository : IRepository<VideoDemo>
{
    Task<IEnumerable<VideoDemo>> GetActiveOrderedAsync();
    Task<IEnumerable<VideoDemo>> GetByCategoryAsync(string category);
}
