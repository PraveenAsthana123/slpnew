using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Services.Interfaces;

public interface INewsletterService
{
    Task<(bool Success, string Message)> SubscribeAsync(string email, string? name = null);
    Task<bool> UnsubscribeAsync(string token);
    Task<bool> ConfirmSubscriptionAsync(string token);
    Task<IEnumerable<NewsletterSubscriber>> GetActiveSubscribersAsync();
    Task<int> GetSubscriberCountAsync();
}
