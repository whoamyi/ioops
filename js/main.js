// ================================
// IOOPS - Main JavaScript
// Interactive Network Animation & Form Handling
// ================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize network canvas animation if present (homepage)
    const networkCanvas = document.getElementById('networkCanvas');
    if (networkCanvas) {
        initNetworkAnimation(networkCanvas);
    }

    // Initialize page header animation if present (other pages)
    const pageCanvas = document.getElementById('pageCanvas');
    if (pageCanvas) {
        initPageAnimation(pageCanvas);
    }

    // Initialize contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        initContactForm(contactForm);
    }

    // Initialize mobile navigation
    initMobileNav();
});

// Flat World Map with Neon Data Lines Animation
function initNetworkAnimation(canvas) {
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Global hubs (x, y as percentage)
    const hubs = [
        { x: 0.48, y: 0.30, name: 'Geneva' },
        { x: 0.50, y: 0.29, name: 'Brussels' },
        { x: 0.22, y: 0.35, name: 'Washington' },
        { x: 0.78, y: 0.52, name: 'Singapore' },
        { x: 0.56, y: 0.43, name: 'Dubai' },
        { x: 0.49, y: 0.28, name: 'London' },
        { x: 0.23, y: 0.33, name: 'New York' },
        { x: 0.83, y: 0.36, name: 'Tokyo' },
        { x: 0.88, y: 0.78, name: 'Sydney' },
        { x: 0.18, y: 0.42, name: 'Mexico City' },
        { x: 0.30, y: 0.68, name: 'São Paulo' },
        { x: 0.58, y: 0.25, name: 'Moscow' },
        { x: 0.52, y: 0.60, name: 'Nairobi' },
        { x: 0.47, y: 0.50, name: 'Cairo' },
        { x: 0.72, y: 0.48, name: 'Mumbai' },
        { x: 0.75, y: 0.40, name: 'Beijing' }
    ];

    const routes = [
        [0, 1], [0, 4], [0, 11], [1, 5], [2, 3], [2, 6], [3, 7], [3, 8],
        [4, 12], [5, 11], [6, 9], [7, 14], [8, 14], [9, 10], [11, 14],
        [12, 13], [13, 14], [0, 5], [3, 15], [7, 15], [1, 11], [4, 13],
        [5, 6], [2, 9], [7, 8], [10, 12], [14, 15]
    ];

    const dataPackets = [];

    function drawWorldMap() {
        ctx.strokeStyle = 'rgba(44, 90, 160, 0.15)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(44, 90, 160, 0.03)';

        const w = canvas.width;
        const h = canvas.height;

        // North America
        ctx.beginPath();
        ctx.moveTo(w * 0.12, h * 0.25);
        ctx.lineTo(w * 0.15, h * 0.20);
        ctx.lineTo(w * 0.28, h * 0.18);
        ctx.lineTo(w * 0.30, h * 0.28);
        ctx.lineTo(w * 0.25, h * 0.35);
        ctx.lineTo(w * 0.20, h * 0.40);
        ctx.lineTo(w * 0.12, h * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // South America
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h * 0.50);
        ctx.lineTo(w * 0.28, h * 0.48);
        ctx.lineTo(w * 0.32, h * 0.55);
        ctx.lineTo(w * 0.30, h * 0.75);
        ctx.lineTo(w * 0.26, h * 0.73);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Europe
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.22);
        ctx.lineTo(w * 0.54, h * 0.20);
        ctx.lineTo(w * 0.55, h * 0.32);
        ctx.lineTo(w * 0.48, h * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Africa
        ctx.beginPath();
        ctx.moveTo(w * 0.48, h * 0.38);
        ctx.lineTo(w * 0.56, h * 0.36);
        ctx.lineTo(w * 0.58, h * 0.65);
        ctx.lineTo(w * 0.52, h * 0.68);
        ctx.lineTo(w * 0.46, h * 0.60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Asia
        ctx.beginPath();
        ctx.moveTo(w * 0.58, h * 0.22);
        ctx.lineTo(w * 0.85, h * 0.18);
        ctx.lineTo(w * 0.88, h * 0.35);
        ctx.lineTo(w * 0.82, h * 0.50);
        ctx.lineTo(w * 0.70, h * 0.52);
        ctx.lineTo(w * 0.60, h * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Australia
        ctx.beginPath();
        ctx.moveTo(w * 0.82, h * 0.72);
        ctx.lineTo(w * 0.92, h * 0.70);
        ctx.lineTo(w * 0.93, h * 0.80);
        ctx.lineTo(w * 0.85, h * 0.82);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawNeonLine(x1, y1, x2, y2, color, opacity = 1) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity * 0.3;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.shadowBlur = 8;
        ctx.globalAlpha = opacity * 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    function drawHub(x, y, active = false) {
        const pulseSize = active ? 3 + Math.sin(Date.now() * 0.005) * 1 : 2;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, pulseSize * 4);
        gradient.addColorStop(0, 'rgba(184, 134, 11, 0.8)');
        gradient.addColorStop(0.5, 'rgba(184, 134, 11, 0.3)');
        gradient.addColorStop(1, 'rgba(184, 134, 11, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, pulseSize * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#B8860B';
        ctx.fillStyle = '#B8860B';
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(184, 134, 11, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, pulseSize + 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    setInterval(() => {
        if (dataPackets.length < 15) {
            const route = routes[Math.floor(Math.random() * routes.length)];
            dataPackets.push({
                route: route,
                progress: 0,
                speed: 0.003 + Math.random() * 0.005,
                color: Math.random() > 0.5 ? '#00FFFF' : '#B8860B'
            });
        }
    }, 800);

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawWorldMap();

        routes.forEach(route => {
            const hub1 = hubs[route[0]];
            const hub2 = hubs[route[1]];
            const x1 = canvas.width * hub1.x;
            const y1 = canvas.height * hub1.y;
            const x2 = canvas.width * hub2.x;
            const y2 = canvas.height * hub2.y;

            drawNeonLine(x1, y1, x2, y2, 'rgba(44, 90, 160, 0.3)', 0.3);
        });

        dataPackets.forEach((packet, index) => {
            packet.progress += packet.speed;

            if (packet.progress >= 1) {
                dataPackets.splice(index, 1);
                return;
            }

            const hub1 = hubs[packet.route[0]];
            const hub2 = hubs[packet.route[1]];
            const x1 = canvas.width * hub1.x;
            const y1 = canvas.height * hub1.y;
            const x2 = canvas.width * hub2.x;
            const y2 = canvas.height * hub2.y;

            const segmentLength = 0.15;
            const segmentStart = Math.max(0, packet.progress - segmentLength);
            const segmentEnd = packet.progress;

            const sx = x1 + (x2 - x1) * segmentStart;
            const sy = y1 + (y2 - y1) * segmentStart;
            const ex = x1 + (x2 - x1) * segmentEnd;
            const ey = y1 + (y2 - y1) * segmentEnd;

            drawNeonLine(sx, sy, ex, ey, packet.color, 1);

            const px = x1 + (x2 - x1) * packet.progress;
            const py = y1 + (y2 - y1) * packet.progress;

            const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
            gradient.addColorStop(0, packet.color);
            gradient.addColorStop(1, packet.color + '00');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fill();
        });

        hubs.forEach(hub => {
            const x = canvas.width * hub.x;
            const y = canvas.height * hub.y;
            const active = dataPackets.some(p =>
                p.route[0] === hubs.indexOf(hub) || p.route[1] === hubs.indexOf(hub)
            );
            drawHub(x, y, active);
        });

        requestAnimationFrame(animate);
    }

    animate();
}
// ================================
// Page Header Animation (Other Pages)
// ================================
function initPageAnimation(canvas) {
    const ctx = canvas.getContext('2d');

    // Set canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Flowing network lines
    const nodes = [];
    const nodeCount = 30;
    const maxDistance = 120;

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            radius: Math.random() * 1.5 + 0.5
        });
    }

    // Data packets
    const packets = [];

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw nodes
        nodes.forEach(node => {
            // Update position
            node.x += node.vx;
            node.y += node.vy;

            // Wrap around edges
            if (node.x < 0) node.x = canvas.width;
            if (node.x > canvas.width) node.x = 0;
            if (node.y < 0) node.y = canvas.height;
            if (node.y > canvas.height) node.y = 0;

            // Draw node
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(44, 90, 160, 0.4)';
            ctx.fill();

            // Pulsing effect
            const pulseSize = node.radius + Math.sin(Date.now() * 0.002 + node.x) * 0.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(184, 134, 11, 0.2)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        });

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.15;

                    // Gradient line
                    const gradient = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
                    gradient.addColorStop(0, `rgba(44, 90, 160, ${opacity})`);
                    gradient.addColorStop(0.5, `rgba(184, 134, 11, ${opacity * 1.5})`);
                    gradient.addColorStop(1, `rgba(44, 90, 160, ${opacity})`);

                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Occasionally create data packet
                    if (Math.random() > 0.995 && packets.length < 20) {
                        packets.push({
                            from: i,
                            to: j,
                            progress: 0,
                            speed: 0.01 + Math.random() * 0.02
                        });
                    }
                }
            }
        }

        // Draw and update packets
        packets.forEach((packet, index) => {
            packet.progress += packet.speed;

            if (packet.progress >= 1) {
                packets.splice(index, 1);
                return;
            }

            const fromNode = nodes[packet.from];
            const toNode = nodes[packet.to];

            const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress;
            const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress;

            // Packet glow
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
            gradient.addColorStop(0, 'rgba(184, 134, 11, 0.8)');
            gradient.addColorStop(0.5, 'rgba(184, 134, 11, 0.4)');
            gradient.addColorStop(1, 'rgba(184, 134, 11, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Packet core
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(184, 134, 11, 1)';
            ctx.fill();
        });

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
