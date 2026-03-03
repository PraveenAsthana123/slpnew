using SLPSystems.Web.Models.Entities;

namespace SLPSystems.Web.Repositories.Interfaces;

public interface ITestimonialRepository : IRepository<Testimonial>
{
    Task<IEnumerable<Testimonial>> GetActiveOrderedAsync();
}
