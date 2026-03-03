using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface ICaseStudyRepository : IRepository<CaseStudy>
{
    Task<CaseStudy?> GetBySlugAsync(string slug);
    Task<IEnumerable<CaseStudy>> GetActiveOrderedAsync();
}
