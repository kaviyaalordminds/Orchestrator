/* ============================================
   AUTH AGENT — Login & Register UI Handler
   ============================================ */

const authAgent = {
  init() {
    this.resetForms();
    
    // Add real-time clear validation on typing
    const inputs = ['loginEmail', 'loginPassword', 'registerName', 'registerEmail', 'registerPassword', 'registerConfirmPassword'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.clearValidation(id));
      }
    });
  },

  onActivate() {
    this.resetForms();
  },

  resetForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
      loginForm.reset();
      loginForm.querySelectorAll('.invalid-feedback').forEach(el => el.style.display = 'none');
      loginForm.querySelectorAll('.form-control').forEach(el => el.style.borderColor = '');
    }
    if (registerForm) {
      registerForm.reset();
      registerForm.querySelectorAll('.invalid-feedback').forEach(el => el.style.display = 'none');
      registerForm.querySelectorAll('.form-control').forEach(el => el.style.borderColor = '');
    }
  },

  forgotPassword() {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
      app.showToast('Reset Password', 'Please enter your email address first', 'warning');
      this.showValidation('loginEmail', 'Please enter your email to reset password.');
      return;
    }
    // TODO: backend does not yet expose a password-reset endpoint. Wire this up
    // once /api/v1/auth/forgot-password exists instead of pretending it worked.
    app.showToast('Not Available Yet', 'Password reset isn\'t wired up yet. Please contact support.', 'warning');
  },

  showValidation(inputId, message) {
    const input = document.getElementById(inputId);
    const feedback = document.getElementById(inputId + 'Feedback');
    if (input) {
      input.style.borderColor = 'var(--danger)';
    }
    if (feedback) {
      feedback.textContent = message;
      feedback.style.display = 'block';
    }
  },

  clearValidation(inputId) {
    const input = document.getElementById(inputId);
    const feedback = document.getElementById(inputId + 'Feedback');
    if (input) {
      input.style.borderColor = '';
    }
    if (feedback) {
      feedback.style.display = 'none';
    }
  },

  async handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    let hasError = false;

    // Reset validations
    this.clearValidation('loginEmail');
    this.clearValidation('loginPassword');

    // Simple client-side validation
    if (!email) {
      this.showValidation('loginEmail', 'Email is required.');
      hasError = true;
    } else if (!this.validateEmail(email)) {
      this.showValidation('loginEmail', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      this.showValidation('loginPassword', 'Password is required.');
      hasError = true;
    }

    if (hasError) return;

    try {
      const res = await fetch(`${app.apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('jwt_token', data.data.token);
        localStorage.setItem('user_info', JSON.stringify(data.data.user));
        app.showToast('Success', `Welcome back, ${data.data.user.full_name || data.data.user.email}!`, 'success');
        app.navigateTo('dashboard');
      } else {
        const errorMsg = data.error?.message || 'Login failed';
        app.showToast('Login Failed', errorMsg, 'danger');
        this.showValidation('loginPassword', errorMsg);
      }
    } catch (err) {
      console.error('Login error:', err);
      app.showToast('Connection Error', 'Could not reach the server. Please check your connection and try again.', 'error');
    }
  },

  async handleRegister() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirm = document.getElementById('registerConfirmPassword').value.trim();
    const agree = document.getElementById('registerAgree').checked;
    let hasError = false;

    // Reset validations
    this.clearValidation('registerName');
    this.clearValidation('registerEmail');
    this.clearValidation('registerPassword');
    this.clearValidation('registerConfirmPassword');

    if (!name) {
      this.showValidation('registerName', 'Full name is required.');
      hasError = true;
    }

    if (!email) {
      this.showValidation('registerEmail', 'Email is required.');
      hasError = true;
    } else if (!this.validateEmail(email)) {
      this.showValidation('registerEmail', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      this.showValidation('registerPassword', 'Password is required.');
      hasError = true;
    } else if (password.length < 8) {
      this.showValidation('registerPassword', 'Password must be at least 8 characters.');
      hasError = true;
    }

    if (!confirm) {
      this.showValidation('registerConfirmPassword', 'Please confirm your password.');
      hasError = true;
    } else if (password !== confirm) {
      this.showValidation('registerConfirmPassword', 'Passwords do not match.');
      hasError = true;
    }

    if (!agree) {
      app.showToast('Terms & Conditions', 'You must agree to the terms to register', 'warning');
      hasError = true;
    }

    if (hasError) return;

    try {
      const res = await fetch(`${app.apiBase}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: name })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('jwt_token', data.data.token);
        localStorage.setItem('user_info', JSON.stringify(data.data.user));
        app.showToast('Registration Complete', 'Account created successfully', 'success');
        app.navigateTo('dashboard');
      } else {
        const errorMsg = data.error?.message || 'Registration failed';
        app.showToast('Registration Failed', errorMsg, 'danger');
        this.showValidation('registerEmail', errorMsg);
      }
    } catch (err) {
      console.error('Registration error:', err);
      app.showToast('Connection Error', 'Could not reach the server. Please check your connection and try again.', 'error');
    }
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
};
