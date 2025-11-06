const storedUserId = (() => {
  try {
    return localStorage.getItem("userId");
  } catch {
    return null;
  }
})();

const storedCredentials = (() => {
  try {
    return localStorage.getItem("credentials");
  } catch {
    return null;
  }
})();

const currentUser = {
  userId: storedUserId,
  credentials: storedCredentials,
};

export function setCurrentUser({ userId, credentials }) {
  if (typeof userId !== "undefined") {
    currentUser.userId = userId;
    try {
      if (userId === null) {
        localStorage.removeItem("userId");
      } else {
        localStorage.setItem("userId", userId);
      }
    } catch {
      // Ignore storage failures (e.g., disabled cookies)
    }
  }

  if (typeof credentials !== "undefined") {
    currentUser.credentials = credentials;
    try {
      if (credentials === null) {
        localStorage.removeItem("credentials");
      } else {
        localStorage.setItem("credentials", credentials);
      }
    } catch {
      // Ignore storage failures
    }
  }
}

export function clearCurrentUser() {
  setCurrentUser({ userId: null, credentials: null });
}

export function isAuthenticated() {
  return Boolean(currentUser.userId && currentUser.credentials);
}

export default currentUser;

