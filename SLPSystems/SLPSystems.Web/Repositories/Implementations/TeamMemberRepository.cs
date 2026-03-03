using Microsoft.EntityFrameworkCore;
using SLPSystems.Web.Data;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;

namespace SLPSystems.Web.Repositories.Implementations;

public class TeamMemberRepository : Repository<TeamMember>, ITeamMemberRepository
{
    public TeamMemberRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<TeamMember>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(tm => tm.IsActive)
            .OrderBy(tm => tm.SortOrder)
            .ToListAsync();
    }
}
