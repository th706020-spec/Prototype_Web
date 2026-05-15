/* Shared nav.js — injects navbar and footer into every page */

(function () {

  /* Detect if we are inside a subdirectory (e.g. /pages/) */
  const inSubdir = window.location.pathname.includes('/pages/');
  const base     = inSubdir ? '../' : '';

  /* --- Navbar --- */
  const navEl = document.getElementById('site-nav');

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
            <a href="#" class="btn btn-outline">Log In</a>
            <a href="#" class="btn btn-primary">Sign Up</a>
          </div>

        </div>
      </nav>
    `;

    /* Mark the matching nav link as active */
    navEl.querySelectorAll('.navbar-links a').forEach(function (link) {
      if (link.href === window.location.href) {
        link.classList.add('active');
      }
    });
  }

  /* --- Footer --- */
  const footerEl = document.getElementById('site-footer');

  if (footerEl) {
    footerEl.innerHTML = `
      <footer>
        <p>&copy; DEADLINE 22/5/2026.</p>
      </footer>
    `;
  }

})();
