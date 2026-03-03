using Microsoft.EntityFrameworkCore;
using SLPSystems.Web.Data;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;

namespace SLPSystems.Web.Repositories.Implementations;

public class VideoDemoRepository : Repository<VideoDemo>, IVideoDemoRepository
{
    public VideoDemoRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<VideoDemo>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(v => v.IsActive)
            .OrderBy(v => v.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<VideoDemo>> GetByCategoryAsync(string category)
    {
        return await _dbSet
            .Where(v => v.IsActive && v.Category == category)
            .OrderBy(v => v.SortOrder)
            .ToListAsync();
    }
}
