// auth.js - Authentication, multilingual translation, tabs, and recovery logic
// Clean, beginner-friendly with no emojis

// Translations Dictionary (English, Kannada, Hindi)
const i18n = {
  en: {
    tagline: "Kirana & General Store Management",
    usernameOrEmail: "Username or Email",
    password: "Password",
    passwordMin6: "Password (min. 6 characters) *",
    confirmPassword: "Confirm Password *",
    signIn: "Sign In",
    forgotPassword: "Forgot password?",
    newUser: "New user?",
    registerHere: "Register here",
    registerShopTitle: "Create Shop Account",
    tabBasic: "Basic",
    tabContact: "Contact",
    tabAccount: "Account",
    shopName: "Shop Name *",
    ownerName: "Owner Name *",
    shopType: "Shop Type",
    optGrocery: "Grocery (Kirana)",
    optGeneralStore: "General Store",
    optClothing: "Clothing",
    optElectronics: "Electronics",
    optOther: "Other",
    ownerPhone: "Owner's Phone Number *",
    shopContactPhone: "Shop Contact Number",
    shopAddress: "Shop Address",
    pincode: "Pincode",
    email: "Email Address *",
    username: "Username (min. 3 characters) *",
    submitRegister: "Complete Registration",
    alreadyHaveAccount: "Already registered?",
    cancel: "Cancel",
    next: "Next",
    back: "Back",
    forgotTitle: "Password Recovery",
    forgotDesc: "Enter your registered email address to receive a demo verification reset code.",
    generateCode: "Get Demo Reset Code",
    demoCodeLabel: "Demo Verification Code",
    enterCode: "Enter Verification Code",
    newPassword: "New Password (min 6 characters)",
    saveNewPassword: "Save New Password",
    backToLogin: "Back to Sign In",
    phUsernameOrEmail: "Enter username or email",
    phPassword: "Enter password",
    phShopName: "e.g. Laxmi General Store",
    phOwnerName: "e.g. Ramesh Kumar",
    phOwnerPhone: "10-digit mobile number",
    phShopPhone: "Landline or mobile",
    phShopAddress: "Street, Market, Area",
    phPincode: "6-digit pincode",
    phEmail: "name@example.com",
    phUsername: "Unique username",
    phConfirmPassword: "Re-enter password",
    msgFillRequired: "Please fill in all required fields marked with *",
    msgPasswordMismatch: "Passwords do not match",
    msgPasswordLength: "Password must be at least 6 characters",
    msgUsernameLength: "Username must be at least 3 characters",
    msgInvalidEmail: "Please enter a valid email address",
    msgRegSuccess: "Registration successful! You can now log in.",
    msgResetSuccess: "Password reset successfully! Please log in with your new password.",
    msgEnterEmailFirst: "Please enter your registered email address first.",
    msgInvalidCode: "Verification code must match the demo code displayed.",
    msgServerUnreachable: "Cannot connect to server at "
  },
  kn: {
    tagline: "ಕಿರಾಣಿ ಮತ್ತು ಜನರಲ್ ಸ್ಟೋರ್ ನಿರ್ವಹಣೆ",
    usernameOrEmail: "ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಇಮೇಲ್",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    passwordMin6: "ಪಾಸ್‌ವರ್ಡ್ (ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳು) *",
    confirmPassword: "ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ *",
    signIn: "ಲಾಗಿನ್ ಮಾಡಿ",
    forgotPassword: "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?",
    newUser: "ಹೊಸ ಬಳಕೆದಾರರೇ?",
    registerHere: "ಇಲ್ಲಿ ನೋಂದಾಯಿಸಿ",
    registerShopTitle: "ಅಂಗಡಿ ಖಾತೆ ತೆರೆಯಿರಿ",
    tabBasic: "ಮೂಲ",
    tabContact: "ಸಂಪರ್ಕ",
    tabAccount: "ಖಾತೆ",
    shopName: "ಅಂಗಡಿಯ ಹೆಸರು *",
    ownerName: "ಮಾಲೀಕರ ಹೆಸರು *",
    shopType: "ಅಂಗಡಿ ವಿಧ",
    optGrocery: "ಕಿರಾಣಿ (ದವಸ ಧಾನ್ಯ)",
    optGeneralStore: "ಜನರಲ್ ಸ್ಟೋರ್",
    optClothing: "ಬಟ್ಟೆ ಅಂಗಡಿ",
    optElectronics: "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್",
    optOther: "ಇತರೆ",
    ownerPhone: "ಮಾಲೀಕರ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ *",
    shopContactPhone: "ಅಂಗಡಿ ದೂರವಾಣಿ ಸಂಖ್ಯೆ",
    shopAddress: "ಅಂಗಡಿಯ ವಿಳಾಸ",
    pincode: "ಪಿನ್‌ಕೋಡ್",
    email: "ಇಮೇಲ್ ವಿಳಾಸ *",
    username: "ಬಳಕೆದಾರ ಹೆಸರು (ಕನಿಷ್ಠ 3 ಅಕ್ಷರ) *",
    submitRegister: "ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಿ",
    alreadyHaveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಹೊಂದಿದ್ದೀರಾ?",
    cancel: "ರದ್ದುಮಾಡಿ",
    next: "ಮುಂದೆ",
    back: "ಹಿಂದೆ",
    forgotTitle: "ಪಾಸ್‌ವರ್ಡ್ ಮರುಪಡೆಯುವಿಕೆ",
    forgotDesc: "ಡೆಮೊ ಪರಿಶೀಲನಾ ಕೋಡ್ ಪಡೆಯಲು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ನಮೂದಿಸಿ.",
    generateCode: "ಡೆಮೊ ಕೋಡ್ ಪಡೆಯಿರಿ",
    demoCodeLabel: "ಡೆಮೊ ಪರಿಶೀಲನಾ ಕೋಡ್",
    enterCode: "ಪರಿಶೀಲನಾ ಕೋಡ್ ನಮೂದಿಸಿ",
    newPassword: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ (ಕನಿಷ್ಠ 6 ಅಕ್ಷರ)",
    saveNewPassword: "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಉಳಿಸಿ",
    backToLogin: "ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    phUsernameOrEmail: "ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಇಮೇಲ್ ಹಾಕಿ",
    phPassword: "ಪಾಸ್‌ವರ್ಡ್ ಹಾಕಿ",
    phShopName: "ಉದಾ. ಲಕ್ಷ್ಮಿ ಜನರಲ್ ಸ್ಟೋರ್",
    phOwnerName: "ಉದಾ. ರಮೇಶ್ ಕುಮಾರ್",
    phOwnerPhone: "10 ಅಂಕಿಗಳ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    phShopPhone: "ದೂರವಾಣಿ ಸಂಖ್ಯೆ",
    phShopAddress: "ರಸ್ತೆ, ಮಾರುಕಟ್ಟೆ, ಪ್ರದೇಶ",
    phPincode: "6 ಅಂಕಿಗಳ ಪಿನ್‌ಕೋಡ್",
    phEmail: "hesaru@example.com",
    phUsername: "ವಿಶಿಷ್ಟ ಬಳಕೆದಾರ ಹೆಸರು",
    phConfirmPassword: "ಪಾಸ್‌ವರ್ಡ್ ಮತ್ತೆ ಹಾಕಿ",
    msgFillRequired: "* ಗುರುತಿಸಲಾದ ಅಗತ್ಯ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ",
    msgPasswordMismatch: "ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ",
    msgPasswordLength: "ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳಾಗಿರಬೇಕು",
    msgUsernameLength: "ಬಳಕೆದಾರ ಹೆಸರು ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳಾಗಿರಬೇಕು",
    msgInvalidEmail: "ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಇಮೇಲ್ ನಮೂದಿಸಿ",
    msgRegSuccess: "ನೋಂದಣಿ ಯಶಸ್ವಿಯಾಗಿದೆ! ಈಗ ನೀವು ಲಾಗಿನ್ ಆಗಬಹುದು.",
    msgResetSuccess: "ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಗಿದೆ! ಹೊಸ ಪಾಸ್‌ವರ್ಡ್‌ನೊಂದಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ.",
    msgEnterEmailFirst: "ಮೊದಲು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ನಮೂದಿಸಿ.",
    msgInvalidCode: "ಪರಿಶೀಲನಾ ಕೋಡ್ ಸರಿಯಾಗಿಲ್ಲ.",
    msgServerUnreachable: "ಸರ್ವರ್ ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ: "
  },
  hi: {
    tagline: "किराना और जनरल स्टोर प्रबंधन",
    usernameOrEmail: "उपयोगकर्ता नाम या ईमेल",
    password: "पासवर्ड",
    passwordMin6: "पासवर्ड (न्यूनतम 6 अक्षर) *",
    confirmPassword: "पासवर्ड की पुष्टि करें *",
    signIn: "साइन इन करें",
    forgotPassword: "पासवर्ड भूल गए?",
    newUser: "नए उपयोगकर्ता?",
    registerHere: "यहाँ रजिस्टर करें",
    registerShopTitle: "दुकान खाता बनाएं",
    tabBasic: "मूल",
    tabContact: "संपर्क",
    tabAccount: "खाता",
    shopName: "दुकान का नाम *",
    ownerName: "मालिक का नाम *",
    shopType: "दुकान का प्रकार",
    optGrocery: "किराना दुकान",
    optGeneralStore: "जनरल स्टोर",
    optClothing: "कपड़ों की दुकान",
    optElectronics: "इलेक्ट्रॉनिक्स",
    optOther: "अन्य",
    ownerPhone: "मालिक का मोबाइल नंबर *",
    shopContactPhone: "दुकान का फोन नंबर",
    shopAddress: "दुकान का पता",
    pincode: "पिनकोड",
    email: "ईमेल पता *",
    username: "यूज़रनेम (न्यूनतम 3 अक्षर) *",
    submitRegister: "रजिस्ट्रेशन पूरा करें",
    alreadyHaveAccount: "क्या पहले से खाता है?",
    cancel: "रद्द करें",
    next: "आगे बढ़ें",
    back: "पीछे",
    forgotTitle: "पासवर्ड रीसेट",
    forgotDesc: "डेमो सत्यापन कोड प्राप्त करने के लिए अपना पंजीकृत ईमेल दर्ज करें।",
    generateCode: "डेमो रीसेट कोड प्राप्त करें",
    demoCodeLabel: "डेमो सत्यापन कोड",
    enterCode: "सत्यापन कोड दर्ज करें",
    newPassword: "नया पासवर्ड (न्यूनतम 6 अक्षर)",
    saveNewPassword: "नया पासवर्ड सहेजें",
    backToLogin: "वापस साइन इन पर जाएं",
    phUsernameOrEmail: "यूज़रनेम या ईमेल दर्ज करें",
    phPassword: "पासवर्ड दर्ज करें",
    phShopName: "उदा. लक्ष्मी जनरल स्टोर",
    phOwnerName: "उदा. रमेश कुमार",
    phOwnerPhone: "10 अंकों का मोबाइल नंबर",
    phShopPhone: "फोन या मोबाइल नंबर",
    phShopAddress: "गली, बाजार, क्षेत्र",
    phPincode: "6 अंकों का पिनकोड",
    phEmail: "naam@example.com",
    phUsername: "अनूठा यूज़रनेम",
    phConfirmPassword: "पासवर्ड दोबारा दर्ज करें",
    msgFillRequired: "* चिह्नित सभी आवश्यक फ़ील्ड भरें",
    msgPasswordMismatch: "पासवर्ड मेल नहीं खाते",
    msgPasswordLength: "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए",
    msgUsernameLength: "यूज़रनेम कम से कम 3 अक्षरों का होना चाहिए",
    msgInvalidEmail: "कृपया एक वैध ईमेल पता दर्ज करें",
    msgRegSuccess: "पंजीकरण सफल रहा! अब आप लॉगिन कर सकते हैं।",
    msgResetSuccess: "पासवर्ड सफलतापूर्वक रीसेट हो गया! कृपया लॉगिन करें।",
    msgEnterEmailFirst: "कृपया पहले अपना पंजीकृत ईमेल दर्ज करें।",
    msgInvalidCode: "सत्यापन कोड स्क्रीन पर दिए गए कोड से मेल नहीं खाता।",
    msgServerUnreachable: "सर्वर से कनेक्ट करने में असमर्थ: "
  }
};

// Global state variables
let currentLang = localStorage.getItem('stockflow_lang') || 'en';
let currentTheme = localStorage.getItem('stockflow_theme') || 'light';
let generatedDemoCode = null;

// Resolve API base URL from config.js or default
const API_BASE = window.STOCKFLOW_API || "http://localhost:3000/api";

// DOM References
const langSelect = document.getElementById('lang-select');
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');
const alertBox = document.getElementById('auth-alert');
const alertText = document.getElementById('alert-text');

// Views
const viewLogin = document.getElementById('view-login');
const viewRegister = document.getElementById('view-register');
const viewForgot = document.getElementById('view-forgot');

// Step tabs & panes for registration
const tab1 = document.getElementById('tab-step-1');
const tab2 = document.getElementById('tab-step-2');
const tab3 = document.getElementById('tab-step-3');
const pane1 = document.getElementById('pane-step-1');
const pane2 = document.getElementById('pane-step-2');
const pane3 = document.getElementById('pane-step-3');

// -------------------------------------------------------------
// Language & Theme Management
// -------------------------------------------------------------
function applyLanguage(lang) {
  if (!i18n[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('stockflow_lang', lang);
  langSelect.value = lang;

  const dict = i18n[lang];

  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Update input placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('stockflow_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  if (themeText) {
    themeText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
}

function applyFontFamily(font) {
  if (!font) font = "'Plus Jakarta Sans', sans-serif";
  localStorage.setItem('stockflow_font_family', font);
  document.documentElement.style.setProperty('--font-family', font);
  const fontSelect = document.getElementById('login-font-select');
  if (fontSelect) fontSelect.value = font;
}

// -------------------------------------------------------------
// Alert Helper Function (No Emojis)
// -------------------------------------------------------------
function showAlert(message, type = 'error') {
  alertBox.className = `auth-alert show ${type}`;
  alertText.textContent = message;
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  alertBox.className = 'auth-alert';
  alertText.textContent = '';
}

// -------------------------------------------------------------
// Show / Hide Password Helper (Clean Text Button)
// -------------------------------------------------------------
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = 'Show';
  }
}

// -------------------------------------------------------------
// View Switching
// -------------------------------------------------------------
function showView(viewId) {
  hideAlert();
  [viewLogin, viewRegister, viewForgot].forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// -------------------------------------------------------------
// Registration Step Navigation
// -------------------------------------------------------------
function setRegisterStep(step) {
  hideAlert();
  [tab1, tab2, tab3].forEach(t => t.classList.remove('active', 'completed'));
  [pane1, pane2, pane3].forEach(p => p.classList.remove('active'));

  if (step === 1) {
    tab1.classList.add('active');
    pane1.classList.add('active');
  } else if (step === 2) {
    tab1.classList.add('completed');
    tab2.classList.add('active');
    pane2.classList.add('active');
  } else if (step === 3) {
    tab1.classList.add('completed');
    tab2.classList.add('completed');
    tab3.classList.add('active');
    pane3.classList.add('active');
  }
}

// -------------------------------------------------------------
// Event Listeners Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved language and theme
  applyLanguage(currentLang);
  applyTheme(currentTheme);

  // If user is already logged in, redirect to dashboard
  const existingToken = localStorage.getItem('stockflow_token');
  if (existingToken) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Language selector
  langSelect.addEventListener('change', (e) => applyLanguage(e.target.value));

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Switch between Login / Register / Forgot
  document.getElementById('link-register').addEventListener('click', (e) => {
    e.preventDefault();
    setRegisterStep(1);
    showView('view-register');
  });

  document.getElementById('link-to-login-from-reg').addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-login');
  });

  document.getElementById('reg-back-to-login').addEventListener('click', () => {
    showView('view-login');
  });

  document.getElementById('link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('forgot-stage-1').style.display = 'block';
    document.getElementById('forgot-stage-2').style.display = 'none';
    showView('view-forgot');
  });

  document.getElementById('link-back-from-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    showView('view-login');
  });

  // Step 1 -> Step 2 validation
  document.getElementById('reg-next-1').addEventListener('click', () => {
    const shopName = document.getElementById('reg-shopName').value.trim();
    const ownerName = document.getElementById('reg-ownerName').value.trim();
    if (!shopName || !ownerName) {
      showAlert(i18n[currentLang].msgFillRequired, 'error');
      return;
    }
    setRegisterStep(2);
  });

  // Step 2 navigation
  document.getElementById('reg-prev-2').addEventListener('click', () => setRegisterStep(1));
  document.getElementById('reg-next-2').addEventListener('click', () => {
    const ownerPhone = document.getElementById('reg-ownerPhone').value.trim();
    if (!ownerPhone) {
      showAlert(i18n[currentLang].msgFillRequired, 'error');
      return;
    }
    setRegisterStep(3);
  });

  // Step 3 navigation
  document.getElementById('reg-prev-3').addEventListener('click', () => setRegisterStep(2));

  // -----------------------------------------------------------
  // LOGIN SUBMIT
  // -----------------------------------------------------------
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showAlert(i18n[currentLang].msgFillRequired, 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = (data && data.error) ? data.error : `HTTP Error ${response.status}: ${response.statusText}`;
        showAlert(errorMsg, 'error');
        submitBtn.disabled = false;
        applyLanguage(currentLang);
        return;
      }

      // Successful login
      localStorage.setItem('stockflow_token', data.token);
      localStorage.setItem('stockflow_user', JSON.stringify(data.user));

      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    } catch (err) {
      // Real network / connection error
      showAlert(`${i18n[currentLang].msgServerUnreachable}${API_BASE}. (${err.message})`, 'error');
      submitBtn.disabled = false;
      applyLanguage(currentLang);
    }
  });

  // -----------------------------------------------------------
  // REGISTRATION SUBMIT
  // -----------------------------------------------------------
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirmPassword').value;

    if (!email || !username || !password || !confirmPassword) {
      showAlert(i18n[currentLang].msgFillRequired, 'error');
      return;
    }
    if (!email.includes('@')) {
      showAlert(i18n[currentLang].msgInvalidEmail, 'error');
      return;
    }
    if (username.length < 3) {
      showAlert(i18n[currentLang].msgUsernameLength, 'error');
      return;
    }
    if (password.length < 6) {
      showAlert(i18n[currentLang].msgPasswordLength, 'error');
      return;
    }
    if (password !== confirmPassword) {
      showAlert(i18n[currentLang].msgPasswordMismatch, 'error');
      return;
    }

    const payload = {
      shopName: document.getElementById('reg-shopName').value.trim(),
      ownerName: document.getElementById('reg-ownerName').value.trim(),
      shopType: document.getElementById('reg-shopType').value,
      ownerPhone: document.getElementById('reg-ownerPhone').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      address: document.getElementById('reg-address').value.trim(),
      pincode: document.getElementById('reg-pincode').value.trim(),
      email,
      username,
      password
    };

    const submitBtn = document.getElementById('btn-register-submit');
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = (data && data.error) ? data.error : `Registration error (${response.status})`;
        showAlert(errorMsg, 'error');
        submitBtn.disabled = false;
        return;
      }

      // Successful registration: go back to login page with success notification
      showView('view-login');
      showAlert(i18n[currentLang].msgRegSuccess, 'success');
      document.getElementById('form-register').reset();
      submitBtn.disabled = false;
    } catch (err) {
      showAlert(`${i18n[currentLang].msgServerUnreachable}${API_BASE}. (${err.message})`, 'error');
      submitBtn.disabled = false;
    }
  });

  // -----------------------------------------------------------
  // FORGOT PASSWORD: REQUEST DEMO CODE
  // -----------------------------------------------------------
  document.getElementById('btn-request-code').addEventListener('click', () => {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email || !email.includes('@')) {
      showAlert(i18n[currentLang].msgEnterEmailFirst, 'error');
      return;
    }

    // Generate 6-digit demo reset code
    generatedDemoCode = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('display-demo-code').textContent = generatedDemoCode;

    // Show stage 2
    document.getElementById('forgot-stage-1').style.display = 'none';
    document.getElementById('forgot-stage-2').style.display = 'block';
    showAlert('Demo reset code generated. Enter the code below to reset your password.', 'info');
  });

  // -----------------------------------------------------------
  // FORGOT PASSWORD: SUBMIT NEW PASSWORD
  // -----------------------------------------------------------
  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('forgot-email').value.trim();
    const enteredCode = document.getElementById('forgot-code').value.trim();
    const newPassword = document.getElementById('forgot-newPassword').value;
    const confirmPassword = document.getElementById('forgot-confirmPassword').value;

    if (!enteredCode || enteredCode !== generatedDemoCode) {
      showAlert(i18n[currentLang].msgInvalidCode, 'error');
      return;
    }
    if (newPassword.length < 6) {
      showAlert(i18n[currentLang].msgPasswordLength, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(i18n[currentLang].msgPasswordMismatch, 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: enteredCode, newPassword })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = (data && data.error) ? data.error : 'Failed to reset password';
        showAlert(errorMsg, 'error');
        return;
      }

      showView('view-login');
      showAlert(i18n[currentLang].msgResetSuccess, 'success');
      document.getElementById('form-forgot').reset();
    } catch (err) {
      showAlert(`${i18n[currentLang].msgServerUnreachable}${API_BASE}. (${err.message})`, 'error');
    }
  });

});
