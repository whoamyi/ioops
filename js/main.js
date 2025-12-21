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

// ================================
// Network Animation (Hero Section)
// ================================
function initNetworkAnimation(canvas) {
    const ctx = canvas.getContext('2d');

    // Set canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        initGlobe();
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let centerX, centerY, globeRadius;
    let rotation = 0;
    const rotationSpeed = 0.002;

    // Global network hubs (latitude, longitude in degrees)
    const hubs = [
        { lat: 46.2, lon: 6.1, name: 'Geneva' },        // Geneva
        { lat: 50.8, lon: 4.3, name: 'Brussels' },      // Brussels
        { lat: 38.9, lon: -77.0, name: 'Washington' },  // Washington DC
        { lat: 1.3, lon: 103.8, name: 'Singapore' },    // Singapore
        { lat: 25.2, lon: 55.3, name: 'Dubai' },        // Dubai
        { lat: 51.5, lon: -0.1, name: 'London' },       // London
        { lat: 40.7, lon: -74.0, name: 'New York' },    // New York
        { lat: 35.7, lon: 139.7, name: 'Tokyo' },       // Tokyo
        { lat: -33.9, lon: 151.2, name: 'Sydney' },     // Sydney
        { lat: 19.4, lon: -99.1, name: 'Mexico City' }, // Mexico City
        { lat: -23.5, lon: -46.6, name: 'São Paulo' },  // São Paulo
        { lat: 55.8, lon: 37.6, name: 'Moscow' }        // Moscow
    ];

    // Data flow particles
    const particles = [];
    const connections = [];

    function initGlobe() {
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        globeRadius = Math.min(canvas.width, canvas.height) * 0.35;

        // Create connections between hubs
        connections.length = 0;
        for (let i = 0; i < hubs.length; i++) {
            for (let j = i + 1; j < hubs.length; j++) {
                if (Math.random() > 0.6) { // Random connections
                    connections.push({
                        from: i,
                        to: j,
                        particles: []
                    });
                }
            }
        }
    }

    // Convert lat/lon to 3D coordinates
    function latLonToXYZ(lat, lon, radius) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + rotation * 180 / Math.PI) * Math.PI / 180;

        return {
            x: radius * Math.sin(phi) * Math.cos(theta),
            y: radius * Math.cos(phi),
            z: radius * Math.sin(phi) * Math.sin(theta)
        };
    }

    // Project 3D to 2D
    function project3D(x, y, z) {
        const scale = 200 / (200 + z);
        return {
            x: centerX + x * scale,
            y: centerY - y * scale,
            scale: scale,
            visible: z > -globeRadius * 0.3
        };
    }

    // Draw globe wireframe
    function drawGlobe() {
        ctx.strokeStyle = 'rgba(44, 90, 160, 0.15)';
        ctx.lineWidth = 1;

        // Draw latitude lines
        for (let lat = -60; lat <= 60; lat += 30) {
            ctx.beginPath();
            let first = true;
            for (let lon = 0; lon <= 360; lon += 10) {
                const pos3d = latLonToXYZ(lat, lon, globeRadius);
                const pos2d = project3D(pos3d.x, pos3d.y, pos3d.z);

                if (pos2d.visible) {
                    if (first) {
                        ctx.moveTo(pos2d.x, pos2d.y);
                        first = false;
                    } else {
                        ctx.lineTo(pos2d.x, pos2d.y);
                    }
                }
            }
            ctx.stroke();
        }

        // Draw longitude lines
        for (let lon = 0; lon < 360; lon += 30) {
            ctx.beginPath();
            let first = true;
            for (let lat = -90; lat <= 90; lat += 10) {
                const pos3d = latLonToXYZ(lat, lon, globeRadius);
                const pos2d = project3D(pos3d.x, pos3d.y, pos3d.z);

                if (pos2d.visible) {
                    if (first) {
                        ctx.moveTo(pos2d.x, pos2d.y);
                        first = false;
                    } else {
                        ctx.lineTo(pos2d.x, pos2d.y);
                    }
                }
            }
            ctx.stroke();
        }
    }

    // Draw connection arc between two points
    function drawArc(hub1, hub2, opacity = 0.3) {
        const pos1_3d = latLonToXYZ(hub1.lat, hub1.lon, globeRadius);
        const pos2_3d = latLonToXYZ(hub2.lat, hub2.lon, globeRadius);

        const pos1 = project3D(pos1_3d.x, pos1_3d.y, pos1_3d.z);
        const pos2 = project3D(pos2_3d.x, pos2_3d.y, pos2_3d.z);

        if (pos1.visible || pos2.visible) {
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);

            // Create curved line
            const steps = 20;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                // Interpolate between two points with arc
                const lat = hub1.lat + (hub2.lat - hub1.lat) * t;
                const lon = hub1.lon + (hub2.lon - hub1.lon) * t;
                const heightBoost = Math.sin(t * Math.PI) * globeRadius * 0.2;

                const pos3d = latLonToXYZ(lat, lon, globeRadius + heightBoost);
                const pos2d = project3D(pos3d.x, pos3d.y, pos3d.z);

                ctx.lineTo(pos2d.x, pos2d.y);
            }

            ctx.strokeStyle = `rgba(184, 134, 11, ${opacity})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update rotation
        rotation += rotationSpeed;

        // Draw globe wireframe
        drawGlobe();

        // Draw connections
        connections.forEach(conn => {
            drawArc(hubs[conn.from], hubs[conn.to], 0.2);

            // Add particles occasionally
            if (Math.random() > 0.98) {
                conn.particles.push({ t: 0, speed: 0.01 + Math.random() * 0.02 });
            }

            // Update and draw particles
            conn.particles = conn.particles.filter(particle => {
                particle.t += particle.speed;
                if (particle.t > 1) return false;

                // Draw particle
                const hub1 = hubs[conn.from];
                const hub2 = hubs[conn.to];
                const t = particle.t;
                const lat = hub1.lat + (hub2.lat - hub1.lat) * t;
                const lon = hub1.lon + (hub2.lon - hub1.lon) * t;
                const heightBoost = Math.sin(t * Math.PI) * globeRadius * 0.2;

                const pos3d = latLonToXYZ(lat, lon, globeRadius + heightBoost);
                const pos2d = project3D(pos3d.x, pos3d.y, pos3d.z);

                if (pos2d.visible) {
                    ctx.beginPath();
                    ctx.arc(pos2d.x, pos2d.y, 2 * pos2d.scale, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(184, 134, 11, 0.8)';
                    ctx.fill();

                    // Glow effect
                    const gradient = ctx.createRadialGradient(pos2d.x, pos2d.y, 0, pos2d.x, pos2d.y, 8 * pos2d.scale);
                    gradient.addColorStop(0, 'rgba(184, 134, 11, 0.4)');
                    gradient.addColorStop(1, 'rgba(184, 134, 11, 0)');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }

                return true;
            });
        });

        // Draw hubs
        hubs.forEach(hub => {
            const pos3d = latLonToXYZ(hub.lat, hub.lon, globeRadius);
            const pos2d = project3D(pos3d.x, pos3d.y, pos3d.z);

            if (pos2d.visible) {
                // Hub node
                ctx.beginPath();
                ctx.arc(pos2d.x, pos2d.y, 4 * pos2d.scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(44, 90, 160, 0.9)';
                ctx.fill();

                // Outer ring
                ctx.beginPath();
                ctx.arc(pos2d.x, pos2d.y, 6 * pos2d.scale, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(44, 90, 160, 0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Pulse effect
                const pulseRadius = 6 + Math.sin(Date.now() * 0.003) * 2;
                ctx.beginPath();
                ctx.arc(pos2d.x, pos2d.y, pulseRadius * pos2d.scale, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(184, 134, 11, 0.3)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });

        requestAnimationFrame(animate);
    }

    initGlobe();
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
