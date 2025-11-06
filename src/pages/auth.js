import { API_BASE_URL } from "../config.js";

const selectors = {
  loginForm: "#loginForm",
  registerForm: "#registerForm",
  loginError: "#loginError",
  registerError: "#registerError",
  loginBtn: "#loginBtn",
  registerBtn: "#registerBtn",
  toggleLinks: "[data-auth-toggle]",
};

const parseInputValue = (selector) => {
  const element = document.querySelector(selector);
  return element instanceof HTMLInputElement ? element.value.trim() : "";
};

const setErrorMessage = (selector, message) => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) return;
  element.textContent = message;
  element.style.display = message ? "block" : "none";
};

const toggleForms = () => {
  const loginForm = document.querySelector(selectors.loginForm);
  const registerForm = document.querySelector(selectors.registerForm);
  if (!(loginForm instanceof HTMLElement) || !(registerForm instanceof HTMLElement)) {
    return;
  }

  const loginHidden = loginForm.style.display === "none";
  loginForm.style.display = loginHidden ? "block" : "none";
  registerForm.style.display = loginHidden ? "none" : "block";
};

const apiRequest = async (method, endpoint, body = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : null,
    });

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { error: "Network error" };
  }
};

const setButtonBusy = (selector, isBusy, busyLabel) => {
  const button = document.querySelector(selector);
  if (!(button instanceof HTMLButtonElement)) return;
  if (isBusy && busyLabel) {
    button.dataset.originalLabel = button.dataset.originalLabel ?? button.textContent ?? "";
    button.textContent = busyLabel;
  } else if (!isBusy && button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }
  button.disabled = isBusy;
};

const handleLogin = async () => {
  setButtonBusy(selectors.loginBtn, true, "Logging in...");
  setErrorMessage(selectors.loginError, "");

  const userId = parseInputValue("#loginUserId");
  const password = parseInputValue("#loginPassword");

  if (!userId || !password) {
    setErrorMessage(selectors.loginError, "Please fill in all fields");
    setButtonBusy(selectors.loginBtn, false);
    return;
  }

  try {
    const passwordHash = CryptoJS.SHA256(password).toString();
    const credentials = `${userId}:${passwordHash}`;
    const response = await fetch(`${API_BASE_URL}/notes`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const result = await response.json();

    if (!result.error) {
      localStorage.setItem("userId", userId);
      localStorage.setItem("credentials", credentials);
      window.location.href = "index.html";
      return;
    }

    setErrorMessage(
      selectors.loginError,
      "Login failed. Please check your credentials.",
    );
  } catch (error) {
    setErrorMessage(selectors.loginError, "Network error occurred. Please try again.");
  } finally {
    setButtonBusy(selectors.loginBtn, false);
  }
};

const handleRegister = async () => {
  setButtonBusy(selectors.registerBtn, true, "Registering...");
  setErrorMessage(selectors.registerError, "");

  const userId = parseInputValue("#registerUserId");
  const password = parseInputValue("#registerPassword");
  const email = parseInputValue("#registerEmail");

  if (!userId || !password) {
    setErrorMessage(selectors.registerError, "Please fill in all required fields");
    setButtonBusy(selectors.registerBtn, false);
    return;
  }

  const passwordHash = CryptoJS.SHA256(password).toString();
  const result = await apiRequest("POST", "/users", {
    user_id: userId,
    password_hash: passwordHash,
    email: email || null,
  });

  if (result.success) {
    localStorage.setItem("userId", userId);
    localStorage.setItem("credentials", `${userId}:${passwordHash}`);
    window.location.href = "index.html";
    return;
  }

  setErrorMessage(
    selectors.registerError,
    "Registration failed. Please try a different user ID.",
  );
  setButtonBusy(selectors.registerBtn, false);
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(selectors.toggleLinks)
    .forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      toggleForms();
    }));

  document
    .querySelector(selectors.loginForm)
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      handleLogin();
    });

  document
    .querySelector(selectors.registerForm)
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      handleRegister();
    });
});
