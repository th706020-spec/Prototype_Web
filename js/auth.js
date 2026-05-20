(function () {
  const TOKEN_KEY = "protocol_token";

  window.Auth = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },

    // Decode JWT payload and check expiry (client-side only, not a security check)
    getUser: function () {
      const token = this.getToken();
      if (!token) return null;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp && payload.exp < Date.now() / 1000) {
          this.logout(false);
          return null;
        }
        return payload;
      } catch {
        return null;
      }
    },

    isLoggedIn: function () {
      return this.getUser() !== null;
    },

    saveToken: function (token) {
      localStorage.setItem(TOKEN_KEY, token);
    },

    // reload = false skips page reload (used during expiry check)
    logout: function (reload) {
      localStorage.removeItem(TOKEN_KEY);
      if (reload !== false) window.location.reload();
    },
  };
})();
