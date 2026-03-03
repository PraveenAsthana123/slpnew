using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface IIndustrySolutionRepository : IRepository<IndustrySolution>
{
    Task<IndustrySolution?> GetBySlugAsync(string slug);
    Task<IEnumerable<IndustrySolution>> GetActiveOrderedAsync();
}
