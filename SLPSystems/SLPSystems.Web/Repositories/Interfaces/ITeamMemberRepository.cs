using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface ITeamMemberRepository : IRepository<TeamMember>
{
    Task<IEnumerable<TeamMember>> GetActiveOrderedAsync();
}
