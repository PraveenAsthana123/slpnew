using Microsoft.EntityFrameworkCore;
using SLPSystems.Web.Data;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;

namespace SLPSystems.Web.Repositories.Implementations;

public class SiteSettingsRepository : ISiteSettingsRepository
{
    private readonly ApplicationDbContext _context;

    public SiteSettingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SiteSettings?> GetAsync()
    {
        return await _context.SiteSettings.FirstOrDefaultAsync();
    }

    public async Task UpdateAsync(SiteSettings settings)
    {
        var existing = await _context.SiteSettings.FirstOrDefaultAsync();
        if (existing == null)
        {
            await _context.SiteSettings.AddAsync(settings);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(settings);
        }
    }
}
