// ================================
// IOOPS - Main JavaScript
// Interactive Network Animation & Form Handling
// ================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize network canvas animation if present
    const networkCanvas = document.getElementById('networkCanvas');
    if (networkCanvas) {
        initNetworkAnimation(networkCanvas);
    }

    // Initialize contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        initContactForm(contactForm);
    }

    // Initialize mobile navigation
    initMobileNav();
});

// ================================
// Network Animation (Hero Section)
// ================================
function initNetworkAnimation(canvas) {
    const ctx = canvas.getContext('2d');

    // Set canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Network nodes
    const nodes = [];
    const nodeCount = 25;
    const maxDistance = 150;

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2 + 1
        });
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw nodes
        nodes.forEach(node => {
            // Update position
            node.x += node.vx;
            node.y += node.vy;

            // Bounce off edges
            if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

            // Draw node
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(184, 134, 11, 0.6)'; // Gold color
            ctx.fill();
        });

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}

// ================================
// Contact Form Handling
// ================================
function initContactForm(form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            organization: document.getElementById('organization').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value
        };

        // Simulate form submission
        console.log('Form submitted:', formData);

        // Show success message
        form.style.display = 'none';
        document.getElementById('formSuccess').style.display = 'block';
    });
}

// ================================
// Mobile Navigation
// ================================
function initMobileNav() {
    const nav = document.querySelector('.main-nav');
    const headerContent = document.querySelector('.header-content');

    // Create menu toggle button if it doesn't exist
    let menuToggle = document.querySelector('.menu-toggle');
    if (!menuToggle) {
        menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '☰';
        menuToggle.setAttribute('aria-label', 'Toggle menu');

        // Insert button after logo section
        const logoSection = document.querySelector('.logo-section');
        logoSection.parentNode.insertBefore(menuToggle, nav);

        // Toggle menu on click
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
            this.innerHTML = nav.classList.contains('active') ? '✕' : '☰';
        });
    }

    // Close menu when clicking on a link
    const navLinks = nav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                nav.classList.remove('active');
                menuToggle.innerHTML = '☰';
            }
        });
    });
}

// ================================
// Smooth Scroll for Anchor Links
// ================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            document.querySelector(href).scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// ================================
// Console branding
// ================================
console.log('%cIOOPS', 'font-size: 24px; font-weight: bold; color: #2C5AA0;');
console.log('%cInternational Operations & Oversight Protocol System', 'font-size: 12px; color: #6C757D;');
