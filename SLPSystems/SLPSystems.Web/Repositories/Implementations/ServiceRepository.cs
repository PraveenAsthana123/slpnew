using Microsoft.EntityFrameworkCore;
using SLPSystems.Web.Data;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;

namespace SLPSystems.Web.Repositories.Implementations;

public class ServiceRepository : Repository<Service>, IServiceRepository
{
    public ServiceRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Service?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.Slug == slug);
    }

    public async Task<IEnumerable<Service>> GetFeaturedAsync()
    {
        return await _dbSet
            .Where(s => s.IsActive && s.IsFeatured)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetByCategoryAsync(string category)
    {
        return await _dbSet
            .Where(s => s.IsActive && s.Category == category)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }
}
