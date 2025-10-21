/**
 * Authentication Form Handlers
 * Client-side validation and submission for login/register forms
 */

// Utility functions
const showLoading = (button, textElementId, spinnerElementId) => {
  button.disabled = true;
  document.getElementById(textElementId).classList.add('d-none');
  document.getElementById(spinnerElementId).classList.remove('d-none');
};

const hideLoading = (button, textElementId, spinnerElementId) => {
  button.disabled = false;
  document.getElementById(textElementId).classList.remove('d-none');
  document.getElementById(spinnerElementId).classList.add('d-none');
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validatePassword = (password) => {
  // Minimum 8 characters, at least one uppercase, one lowercase, one number
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return {
    isValid: minLength && hasUpper && hasLower && hasNumber,
    minLength,
    hasUpper,
    hasLower,
    hasNumber
  };
};

const setFieldError = (fieldId, message) => {
  const field = document.getElementById(fieldId);
  const feedback = field.parentElement.querySelector('.invalid-feedback') ||
                   field.nextElementSibling;

  field.classList.add('is-invalid');
  field.classList.remove('is-valid');

  if (feedback && feedback.classList.contains('invalid-feedback')) {
    feedback.textContent = message;
  }
};

const setFieldValid = (fieldId) => {
  const field = document.getElementById(fieldId);
  field.classList.remove('is-invalid');
  field.classList.add('is-valid');
};

const clearFieldValidation = (fieldId) => {
  const field = document.getElementById(fieldId);
  field.classList.remove('is-invalid', 'is-valid');
};

// Login Form Handler
if (document.getElementById('loginForm')) {
  const loginForm = document.getElementById('loginForm');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const loginButton = document.getElementById('loginButton');

  // Real-time validation
  emailField.addEventListener('blur', () => {
    if (!emailField.value) {
      setFieldError('email', 'Email is required');
    } else if (!validateEmail(emailField.value)) {
      setFieldError('email', 'Please enter a valid email address');
    } else {
      setFieldValid('email');
    }
  });

  emailField.addEventListener('input', () => {
    if (emailField.classList.contains('is-invalid')) {
      clearFieldValidation('email');
    }
  });

  passwordField.addEventListener('blur', () => {
    if (!passwordField.value) {
      setFieldError('password', 'Password is required');
    } else {
      setFieldValid('password');
    }
  });

  passwordField.addEventListener('input', () => {
    if (passwordField.classList.contains('is-invalid')) {
      clearFieldValidation('password');
    }
  });

  // Form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all fields
    let isValid = true;

    if (!emailField.value) {
      setFieldError('email', 'Email is required');
      isValid = false;
    } else if (!validateEmail(emailField.value)) {
      setFieldError('email', 'Please enter a valid email address');
      isValid = false;
    }

    if (!passwordField.value) {
      setFieldError('password', 'Password is required');
      isValid = false;
    }

    if (!isValid) return;

    // Show loading state
    showLoading(loginButton, 'buttonText', 'buttonSpinner');

    // Submit form via fetch
    try {
      const formData = {
        email: emailField.value,
        password: passwordField.value,
        rememberMe: document.getElementById('rememberMe')?.checked || false
      };

      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the specified URL
        window.location.href = data.redirectTo || '/dashboard';
      } else {
        // Show error message
        hideLoading(loginButton, 'buttonText', 'buttonSpinner');

        if (data.error) {
          // Show error above form
          const alertDiv = document.createElement('div');
          alertDiv.className = 'alert alert-danger';
          alertDiv.setAttribute('role', 'alert');
          alertDiv.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${data.error}`;

          const form = document.getElementById('loginForm');
          form.parentElement.insertBefore(alertDiv, form);

          // Remove alert after 5 seconds
          setTimeout(() => alertDiv.remove(), 5000);
        } else {
          alert('Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      hideLoading(loginButton, 'buttonText', 'buttonSpinner');
      alert('An error occurred. Please try again.');
    }
  });
}

// Register Form Handler
if (document.getElementById('registerForm')) {
  const registerForm = document.getElementById('registerForm');
  const fullNameField = document.getElementById('fullName');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirmPassword');
  const registerButton = document.getElementById('registerButton');

  // Password strength indicator
  const updatePasswordStrength = (password) => {
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    if (!password) {
      strengthContainer.style.display = 'none';
      return;
    }

    strengthContainer.style.display = 'block';

    const validation = validatePassword(password);
    let strength = 0;
    let strengthClass = '';
    let strengthLabel = '';

    if (validation.minLength) strength++;
    if (validation.hasUpper) strength++;
    if (validation.hasLower) strength++;
    if (validation.hasNumber) strength++;

    if (strength <= 2) {
      strengthClass = 'strength-weak';
      strengthLabel = 'Weak password';
    } else if (strength === 3) {
      strengthClass = 'strength-medium';
      strengthLabel = 'Medium strength';
    } else {
      strengthClass = 'strength-strong';
      strengthLabel = 'Strong password';
    }

    strengthBar.className = 'strength-bar-fill ' + strengthClass;
    strengthText.textContent = strengthLabel;
  };

  // Real-time validation
  fullNameField.addEventListener('blur', () => {
    if (!fullNameField.value || fullNameField.value.trim().length < 2) {
      setFieldError('fullName', 'Please enter your full name');
    } else {
      setFieldValid('fullName');
    }
  });

  emailField.addEventListener('blur', () => {
    if (!emailField.value) {
      setFieldError('email', 'Email is required');
    } else if (!validateEmail(emailField.value)) {
      setFieldError('email', 'Please enter a valid email address');
    } else {
      setFieldValid('email');
    }
  });

  passwordField.addEventListener('input', () => {
    updatePasswordStrength(passwordField.value);

    // Re-validate confirm password if it has a value
    if (confirmPasswordField.value) {
      if (passwordField.value !== confirmPasswordField.value) {
        setFieldError('confirmPassword', 'Passwords do not match');
      } else {
        setFieldValid('confirmPassword');
      }
    }
  });

  passwordField.addEventListener('blur', () => {
    const validation = validatePassword(passwordField.value);

    if (!passwordField.value) {
      setFieldError('password', 'Password is required');
    } else if (!validation.isValid) {
      let errorMsg = 'Password must contain: ';
      const missing = [];
      if (!validation.minLength) missing.push('8+ characters');
      if (!validation.hasUpper) missing.push('uppercase letter');
      if (!validation.hasLower) missing.push('lowercase letter');
      if (!validation.hasNumber) missing.push('number');

      setFieldError('password', errorMsg + missing.join(', '));
    } else {
      setFieldValid('password');
    }
  });

  confirmPasswordField.addEventListener('input', () => {
    if (confirmPasswordField.classList.contains('is-invalid')) {
      clearFieldValidation('confirmPassword');
    }
  });

  confirmPasswordField.addEventListener('blur', () => {
    if (!confirmPasswordField.value) {
      setFieldError('confirmPassword', 'Please confirm your password');
    } else if (passwordField.value !== confirmPasswordField.value) {
      setFieldError('confirmPassword', 'Passwords do not match');
    } else {
      setFieldValid('confirmPassword');
    }
  });

  // Form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all fields
    let isValid = true;

    if (!fullNameField.value || fullNameField.value.trim().length < 2) {
      setFieldError('fullName', 'Please enter your full name');
      isValid = false;
    }

    if (!emailField.value) {
      setFieldError('email', 'Email is required');
      isValid = false;
    } else if (!validateEmail(emailField.value)) {
      setFieldError('email', 'Please enter a valid email address');
      isValid = false;
    }

    const passwordValidation = validatePassword(passwordField.value);
    if (!passwordField.value) {
      setFieldError('password', 'Password is required');
      isValid = false;
    } else if (!passwordValidation.isValid) {
      setFieldError('password', 'Password does not meet requirements');
      isValid = false;
    }

    if (!confirmPasswordField.value) {
      setFieldError('confirmPassword', 'Please confirm your password');
      isValid = false;
    } else if (passwordField.value !== confirmPasswordField.value) {
      setFieldError('confirmPassword', 'Passwords do not match');
      isValid = false;
    }

    if (!isValid) {
      // Focus on first invalid field
      const firstInvalid = registerForm.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Show loading state
    showLoading(registerButton, 'buttonText', 'buttonSpinner');

    // Submit form
    try {
      registerForm.submit();
    } catch (error) {
      console.error('Registration error:', error);
      hideLoading(registerButton, 'buttonText', 'buttonSpinner');
      alert('An error occurred. Please try again.');
    }
  });
}

// Accessibility: Announce validation errors to screen readers
const announceError = (message) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'alert');
  announcement.setAttribute('aria-live', 'assertive');
  announcement.className = 'visually-hidden';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
