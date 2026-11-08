
/* Supabase password reset helpers.
   Works with supabase.js creating `supabaseClient` or `supabase`.
*/
(function () {
  function getClient() {
    try {
      if (
        typeof supabaseClient !== "undefined" &&
        supabaseClient?.auth
      ) {
        return supabaseClient;
      }
    } catch (_) {}

    try {
      if (
        typeof supabase !== "undefined" &&
        supabase?.auth
      ) {
        return supabase;
      }
    } catch (_) {}

    if (window.supabaseClient?.auth) {
      return window.supabaseClient;
    }

    return null;
  }

  // Show/hide password buttons.
 
document
  .querySelectorAll("[data-password-target]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(
        button.dataset.passwordTarget
      );

      if (!input) return;

      const show = input.type === "password";

      input.type = show ? "text" : "password";

      button.textContent = show ? "Hide" : "Show";

      button.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password"
      );

      button.setAttribute("aria-pressed", String(show));
    });
  });

  // Send password-reset email from the login page.
  const forgotLink = document.getElementById(
    "forgot-password-link"
  );

  if (forgotLink) {
    forgotLink.addEventListener("click", async (event) => {
      event.preventDefault();

      const client = getClient();
      const emailInput = document.getElementById("login-email");
      const message = document.getElementById("auth-message");
      const email = emailInput
        ? emailInput.value.trim()
        : "";

      if (!client) {
        if (message) {
          message.textContent =
            "Authentication setup not found. Check supabase.js.";
        }
        return;
      }

      if (!email) {
        if (message) {
          message.textContent =
            "Enter your email address first.";
        }
        if (emailInput) emailInput.focus();
        return;
      }

      forgotLink.textContent = "Sending email…";
      forgotLink.setAttribute("aria-disabled", "true");

      try {
        
            const redirectTo =
  "https://expensestracker.saikrishnacheruvugattu08.workers.dev/reset-password.html";

        const { error } =
          await client.auth.resetPasswordForEmail(email, {
            redirectTo
          });

        if (message) {
          message.textContent = error
            ? error.message
            : "If this email belongs to an account, a reset link has been sent. Check your inbox and spam folder.";
        }
      } catch (error) {
        if (message) {
          message.textContent =
            "Could not send the reset email. Check your connection and try again.";
        }
        console.error("Password reset email error:", error);
      } finally {
        forgotLink.textContent = "Forgot password?";
        forgotLink.removeAttribute("aria-disabled");
      }
    });
  }

  // Update the password on reset-password.html.
  const resetForm = document.getElementById(
    "reset-password-form"
  );

  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const client = getClient();
      const passwordInput =
        document.getElementById("new-password");
      const confirmationInput =
        document.getElementById("confirm-password");
      const message =
        document.getElementById("reset-message");
      const submitButton = resetForm.querySelector(
        'button[type="submit"]'
      );

      if (!client) {
        if (message) {
          message.textContent =
            "Authentication setup not found. Check supabase.js.";
        }
        return;
      }

      const password = passwordInput.value;
      const confirmation = confirmationInput.value;

      if (password.length < 6) {
        message.textContent =
          "Use at least 6 characters for your password.";
        return;
      }

      if (password !== confirmation) {
        message.textContent =
          "The passwords do not match. Please try again.";
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Updating password…";
      }

      try {
        const { error } = await client.auth.updateUser({
          password
        });

        if (error) {
          message.textContent = error.message;
        } else {
          message.textContent =
            "Password updated successfully. You can now return to login.";

          resetForm.reset();
        }
      } catch (error) {
        message.textContent =
          "Could not update your password. Open the reset link from your email and try again.";
        console.error("Password update error:", error);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML =
            'Update password <span>→</span>';
        }
      }
    });
  }
})();
