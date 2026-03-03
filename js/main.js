/* ============================================
   SLP Systems — Main JavaScript
   ============================================ */

(function () {
    'use strict';

    // --- Navbar scroll effect ---
    const navbar = document.getElementById('navbar');

    function handleNavScroll() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();

    // --- Mobile menu toggle ---
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    navToggle.addEventListener('click', function () {
        const isOpen = navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
        navToggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close mobile menu on link click
    navMenu.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var parentDropdown = link.closest('.has-dropdown');

            // On mobile, toggle dropdown instead of navigating
            if (parentDropdown && window.innerWidth <= 768) {
                var isOpen = parentDropdown.classList.contains('open');
                // Close all other dropdowns
                document.querySelectorAll('.has-dropdown.open').forEach(function (d) {
                    if (d !== parentDropdown) d.classList.remove('open');
                });
                parentDropdown.classList.toggle('open');
                if (!isOpen) {
                    e.preventDefault();
                    return;
                }
            }

            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });

    // Close mobile menu on dropdown link click
    navMenu.querySelectorAll('.dropdown-link').forEach(function (link) {
        link.addEventListener('click', function () {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });

    // --- Hero Carousel ---
    var slides = document.querySelectorAll('.hero-slide');
    var dots = document.querySelectorAll('.hero-dot');
    var currentSlide = 0;
    var slideInterval;
    var totalSlides = slides.length;

    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        currentSlide = (index + totalSlides) % totalSlides;
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    function startAutoplay() {
        slideInterval = setInterval(nextSlide, 5000);
    }

    function resetAutoplay() {
        clearInterval(slideInterval);
        startAutoplay();
    }

    // Dot navigation
    dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            var target = parseInt(this.getAttribute('data-slide'), 10);
            goToSlide(target);
            resetAutoplay();
        });
    });

    // Arrow navigation
    var arrowLeft = document.querySelector('.hero-arrow-left');
    var arrowRight = document.querySelector('.hero-arrow-right');

    if (arrowLeft) {
        arrowLeft.addEventListener('click', function () {
            prevSlide();
            resetAutoplay();
        });
    }

    if (arrowRight) {
        arrowRight.addEventListener('click', function () {
            nextSlide();
            resetAutoplay();
        });
    }

    // Keyboard navigation for carousel
    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') {
            prevSlide();
            resetAutoplay();
        } else if (e.key === 'ArrowRight') {
            nextSlide();
            resetAutoplay();
        }
    });

    startAutoplay();

    // --- Scroll-triggered fade-in animations ---
    var fadeElements = document.querySelectorAll('.fade-in');

    var fadeObserver = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px',
        }
    );

    fadeElements.forEach(function (el) {
        fadeObserver.observe(el);
    });

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;

            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Active nav link on scroll ---
    var sections = document.querySelectorAll('section[id]');

    function updateActiveNav() {
        var scrollPos = window.scrollY + 100;

        sections.forEach(function (section) {
            var top = section.offsetTop;
            var height = section.offsetHeight;
            var id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos < top + height) {
                document.querySelectorAll('.nav-link').forEach(function (link) {
                    link.classList.remove('active-link');
                });
                var activeLink = document.querySelector('.nav-link[href="#' + id + '"]');
                if (activeLink) {
                    activeLink.classList.add('active-link');
                }
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
})();
