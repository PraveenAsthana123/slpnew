using Microsoft.Extensions.Logging;
using SLPSystems.Web.Models.Entities;
using SLPSystems.Web.Repositories.Interfaces;
using SLPSystems.Web.Services.Interfaces;

namespace SLPSystems.Web.Services.Implementations;

public class EmailService : IEmailService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IUnitOfWork unitOfWork, ILogger<EmailService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task SendContactNotificationAsync(ContactMessage message)
    {
        var settings = await _unitOfWork.SiteSettings.GetAsync();
        var recipientEmail = settings?.Email ?? "admin@slpsystems.com";

        _logger.LogInformation(
            "Would send contact notification email to {RecipientEmail} with subject " +
            "\"New Contact Form Submission from {SenderName}\" " +
            "(Message ID: {MessageId}, Sender: {SenderEmail}, Subject: {MessageSubject})",
            recipientEmail,
            message.Name,
            message.Id,
            message.Email,
            message.Subject);
    }

    public async Task SendContactAutoReplyAsync(ContactMessage message)
    {
        var settings = await _unitOfWork.SiteSettings.GetAsync();
        var companyName = settings?.CompanyName ?? "SLP Systems";

        _logger.LogInformation(
            "Would send auto-reply email to {RecipientEmail} with subject " +
            "\"Thank you for contacting {CompanyName}\" " +
            "(Message ID: {MessageId})",
            message.Email,
            companyName,
            message.Id);
    }

    public async Task SendNewsletterConfirmationAsync(string email, string token)
    {
        var settings = await _unitOfWork.SiteSettings.GetAsync();
        var companyName = settings?.CompanyName ?? "SLP Systems";

        _logger.LogInformation(
            "Would send newsletter confirmation email to {RecipientEmail} with subject " +
            "\"Confirm your {CompanyName} newsletter subscription\" " +
            "(Confirmation Token: {Token})",
            email,
            companyName,
            token);
    }
}
