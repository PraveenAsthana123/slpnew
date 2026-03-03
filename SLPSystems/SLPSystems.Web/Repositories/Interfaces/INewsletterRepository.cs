using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface INewsletterRepository : IRepository<NewsletterSubscriber>
{
    Task<NewsletterSubscriber?> GetByEmailAsync(string email);
    Task<NewsletterSubscriber?> GetByTokenAsync(string token);
    Task<IEnumerable<NewsletterSubscriber>> GetActiveSubscribersAsync();
}
