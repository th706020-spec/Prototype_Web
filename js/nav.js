(function () {
  const inSubdir = window.location.pathname.includes("/pages/");
  const base = inSubdir ? "../" : "";

  const navEl = document.getElementById("site-nav");

  if (navEl) {
    navEl.innerHTML = `
      <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="navbar-inner">

          <ul class="navbar-links">
            <li><a href="${base}index.html">Home</a></li>
            <li><a href="#">About</a></li>
          </ul>

          <div class="navbar-logo">
            <a href="${base}index.html" class="logo-placeholder" title="Protocol">
              &#9670; Logo
            </a>
          </div>

          <div class="navbar-auth">
            <button id="theme-toggle" class="btn btn-outline" title="Chuyển đổi Sáng/Tối">🌙</button>
            <a href="#" class="btn btn-outline">Log In</a>
            <a href="#" class="btn btn-primary">Sign Up</a>
          </div>

        </div>
      </nav>
    `;

    navEl.querySelectorAll(".navbar-links a").forEach(function (link) {
      if (link.href === window.location.href) {
        link.classList.add("active");
      }
    });

    const themeToggleBtn = document.getElementById("theme-toggle");
    const body = document.body;

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      body.classList.add("dark");
      if (themeToggleBtn) themeToggleBtn.innerText = "☀️";
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        body.classList.toggle("dark");

        const isDarkMode = body.classList.contains("dark");

        if (isDarkMode) {
          themeToggleBtn.innerText = "☀️";
          localStorage.setItem("theme", "dark");
        } else {
          themeToggleBtn.innerText = "🌙";
          localStorage.setItem("theme", "light");
        }
      });
    }
  }

  const footerEl = document.getElementById("site-footer");

  if (footerEl) {
    footerEl.innerHTML = `
      <footer>
        <p>&copy; DEADLINE 22/5/2026.</p>
      </footer>
    `;
  }
})();
