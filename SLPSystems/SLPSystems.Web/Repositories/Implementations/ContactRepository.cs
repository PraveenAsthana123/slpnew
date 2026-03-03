using Microsoft.EntityFrameworkCore;
using SLPSystems.Web.Data;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;

namespace SLPSystems.Web.Repositories.Implementations;

public class ContactRepository : Repository<ContactMessage>, IContactRepository
{
    public ContactRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<int> GetUnreadCountAsync()
    {
        return await _dbSet.CountAsync(cm => !cm.IsRead && !cm.IsArchived);
    }

    public async Task MarkAsReadAsync(int id)
    {
        var message = await _dbSet.FindAsync(id);
        if (message != null)
        {
            message.IsRead = true;
        }
    }
}
