// Dark mode functionality
function toggleMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    
    // Update mode icon
    const modeIcon = document.querySelector('.mode-icon');
    if (modeIcon) {
        modeIcon.textContent = isDark ? '☀️' : '🌙';
    }
}

// Initialize dark mode from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark');
        const modeIcon = document.querySelector('.mode-icon');
        if (modeIcon) {
            modeIcon.textContent = '☀️';
        }
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return; // Skip empty hash links
            
            e.preventDefault();
            try {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            } catch (err) {
                console.warn('Invalid scroll target:', href);
            }
        });
    });
    
    // Mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }
    
    // Add scroll effect to navbar
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                navbar.style.background = 'rgba(248, 250, 252, 0.95)';
                if (document.body.classList.contains('dark')) {
                    navbar.style.background = 'rgba(15, 23, 42, 0.95)';
                }
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.25)';
                if (document.body.classList.contains('dark')) {
                    navbar.style.background = 'rgba(30, 41, 59, 0.25)';
                }
            }
        });
    }
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.feature-card, .stat, .about-description').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Password toggle functionality
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.parentElement.querySelector('.password-toggle .toggle-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
    } else {
        input.type = 'password';
        toggle.textContent = '👁️';
    }
}

// Form validation utilities
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

// API utilities
async function fetchApi(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const url = window.buildSkillLinkApiUrl
            ? window.buildSkillLinkApiUrl(endpoint)
            : (endpoint.startsWith('http') ? endpoint : `http://localhost:5000/api${endpoint}`);
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            logout();
            throw new Error('Session expired. Please log in again.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// Loading state management
function setLoadingState(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    
    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.style.opacity = '0';
        if (btnLoader) btnLoader.style.display = 'block';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.style.display = 'none';
    }
}

// Show result message
function showResult(elementId, message, type = 'info') {
    const resultElement = document.getElementById(elementId);
    if (resultElement) {
        resultElement.textContent = message;
        resultElement.className = `result ${type}`;
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                resultElement.style.opacity = '0';
                setTimeout(() => {
                    resultElement.textContent = '';
                    resultElement.className = 'result';
                    resultElement.style.opacity = '1';
                }, 300);
            }, 5000);
        }
    }
}

// Local storage utilities
function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function getFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Redirect if authenticated
function redirectIfAuthenticated(redirectUrl = 'dashboard.html') {
    if (isAuthenticated()) {
        window.location.href = redirectUrl;
    }
}

// Logout functionality
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Initialize page-specific functionality
function initializePage() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
        case 'login.html':
            // Check if already logged in
            if (isAuthenticated()) {
                window.location.href = 'dashboard.html';
            }
            break;
            
        case 'register.html':
            // Check if already logged in
            if (isAuthenticated()) {
                window.location.href = 'dashboard.html';
            }
            break;
            
        case 'dashboard.html':
            // Check if not logged in
            if (!isAuthenticated()) {
                window.location.href = 'login.html';
            }
            break;
    }
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Handle form submissions with better error handling
function handleFormSubmission(formId, apiEndpoint, successCallback, errorCallback) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        setLoadingState(submitBtn, true);
        
        try {
            const response = await fetchApi(apiEndpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (successCallback) {
                successCallback(response);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            if (errorCallback) {
                errorCallback(error);
            }
        } finally {
            setLoadingState(submitBtn, false);
        }
    });
}

// Debounce function for search and validation
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add ripple effect to buttons
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Add CSS for ripple effect
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);
