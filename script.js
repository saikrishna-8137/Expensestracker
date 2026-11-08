let archivedExpenses = [];
let loadingArchive = false;
const authSection = document.getElementById("auth-section");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authMessage = document.getElementById("auth-message");
const appMessage = document.getElementById("app-message");
const expenseForm = document.getElementById("expense-form");
const expenseList = document.getElementById("expense-list");

let currentUser = null;
let expenses = [];
let editingExpenseId = null;
let loadingExpenses = false;
let loadAgainRequested = false;
let authGeneration = 0;

const CATEGORIES = [
  "Food", "Groceries", "Transport", "Bills", "Shopping",
  "Health", "Education", "Entertainment", "Other"
];

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function showAppMessage(message, isError = false) {
  appMessage.textContent = message;
  appMessage.classList.toggle("error", isError);
}

function todayLocal() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateStringValue) {
  return parseLocalDate(dateStringValue).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function dateRangeLabel(start, end) {
  const options = { day: "2-digit", month: "short" };
  const first = start.toLocaleDateString("en-IN", options);
  const last = end.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  return `${first} – ${last}`;
}

function sumExpenses(list) {
  return list.reduce((total, expense) => total + Number(expense.amount), 0);
}

function isSameDateRange(date, start, end) {
  return date >= dateString(start) && date <= dateString(end);
}

// Login / Register tab controls.
document.getElementById("show-login").addEventListener("click", () => {
  loginForm.hidden = false;
  registerForm.hidden = true;
  document.getElementById("show-login").classList.add("active");
  document.getElementById("show-register").classList.remove("active");
  showAuthMessage("");
});

document.getElementById("show-register").addEventListener("click", () => {
  loginForm.hidden = true;
  registerForm.hidden = false;
  document.getElementById("show-register").classList.add("active");
  document.getElementById("show-login").classList.remove("active");
  showAuthMessage("");
});

// Show / hide password buttons.
document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordTarget);
    const shouldShow = input.type === "password";

    input.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "Hide" : "Show";
    button.setAttribute("aria-pressed", String(shouldShow));
    button.setAttribute(
      "aria-label",
      shouldShow ? "Hide password" : "Show password"
    );
  });
});

// Reset password visibility when switching forms.
function resetPasswordVisibility(form) {
  form.querySelectorAll(".password-toggle").forEach((button) => {
    const input = document.getElementById(button.dataset.passwordTarget);
    input.type = "password";
    button.textContent = "Show";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Show password");
  });
}

// Register account.
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const submitButton = registerForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  showAuthMessage("Creating your account...");

  try {
    
const { data, error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo:
      "https://expensestracker.saikrishnacheruvugattu08.workers.dev/"
  }
});


    if (error) {
      showAuthMessage(error.message, true);
      return;
    }

    if (data.session && data.user) {
      showAuthMessage("");
      await displayDashboard(data.user);
    } else {
      showAuthMessage(
        "Account created! Check your email, confirm your account, then log in."
      );
    }
  } catch (error) {
    showAuthMessage(error.message || "Could not create your account.", true);
  } finally {
    submitButton.disabled = false;
  }
});

// Log in.
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const submitButton = loginForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  showAuthMessage("Logging in...");

  try {
    const { data, error } =
  await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

if (error) {
  const message = document.getElementById("auth-message");

  if (error.message.toLowerCase().includes("email not confirmed")) {
    message.textContent =
      "Please confirm your email before logging in.";
  } else if (
    error.message.toLowerCase().includes("invalid login credentials")
  ) {
    message.textContent =
      "Incorrect email or password. Please try again.";
  } else {
    message.textContent =
      "Login failed. Please try again.";
  }

  return;
}

    showAuthMessage("");
    await displayDashboard(data.user);
  } catch (error) {
    showAuthMessage(error.message || "Could not log in.", true);
  } finally {
    submitButton.disabled = false;
  }
});

// Display dashboard.
async function displayDashboard(user) {
  if (!user) return;

  currentUser = user;
  authGeneration++;

  authSection.hidden = true;
  dashboard.hidden = false;

  document.getElementById("user-email").textContent =
    "Signed in as " + user.email;

  showAppMessage("");
  await loadExpenses();
}

// Log out.
document.getElementById("logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showAppMessage(error.message, true);
    return;
  }

  currentUser = null;
  expenses = [];
  editingExpenseId = null;
  authGeneration++;

  dashboard.hidden = true;
  authSection.hidden = false;

  loginForm.reset();
  registerForm.reset();
  resetPasswordVisibility(loginForm);
  resetPasswordVisibility(registerForm);
  resetExpenseForm();

  renderExpenses();
  showAuthMessage("You have logged out.");
});

// Reset the expense form.
function resetExpenseForm() {
  expenseForm.reset();
  editingExpenseId = null;

  document.getElementById("expense-date").value = todayLocal();
  document.getElementById("expense-form-title").textContent = "Add an expense";
  document.getElementById("save-expense-button").textContent = "Save expense →";
  document.getElementById("cancel-edit-button").hidden = true;
}

document.getElementById("cancel-edit-button").addEventListener("click", () => {
  resetExpenseForm();
  showAppMessage("Editing cancelled.");
});

// Add or update expense.
expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showAppMessage("Please log in first.", true);
    return;
  }

  const item = document.getElementById("expense-item").value.trim();
  const amount = Number(document.getElementById("expense-amount").value);
  const category = document.getElementById("expense-category").value;
  const expenseDate = document.getElementById("expense-date").value;
  const notes = document.getElementById("expense-notes").value.trim();

  if (!item || item.length > 120) {
    showAppMessage("Enter an item name of up to 120 characters.", true);
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
    showAppMessage("Enter a valid amount greater than zero.", true);
    return;
  }

  if (!CATEGORIES.includes(category)) {
    showAppMessage("Please choose a valid category.", true);
    return;
  }

  if (!expenseDate) {
    showAppMessage("Please select the expense date.", true);
    return;
  }

  const submitButton = document.getElementById("save-expense-button");
  const wasEditing = Boolean(editingExpenseId);
  const savedUserId = currentUser.id;

  submitButton.disabled = true;
  showAppMessage(wasEditing ? "Updating expense..." : "Saving expense...");

  const expenseData = {
    item,
    amount,
    category,
    expense_date: expenseDate,
    notes
  };

  try {
    let result;

    if (wasEditing) {
      result = await supabaseClient
        .from("expenses")
        .update(expenseData)
        .eq("id", editingExpenseId)
        .eq("user_id", savedUserId)
        .select();
    } else {
      result = await supabaseClient
        .from("expenses")
        .insert({
          ...expenseData,
          user_id: savedUserId
        })
        .select();
    }

    if (result.error) {
      showAppMessage(result.error.message, true);
      return;
    }

    if (!result.data || result.data.length === 0) {
      showAppMessage(
        "No change was saved. Please refresh and try again.",
        true
      );
      return;
    }

    resetExpenseForm();
    showAppMessage(wasEditing ? "Expense updated successfully." : "Expense saved successfully.");

    await loadExpenses();
  } catch (error) {
    showAppMessage(error.message || "Could not save the expense.", true);
  } finally {
    submitButton.disabled = false;
  }
});

// Load current user's expenses. RLS also enforces ownership in Supabase.

async function loadExpenses() {
  if (!currentUser) return;

  if (loadingExpenses) {
    loadAgainRequested = true;
    return;
  }

  loadingExpenses = true;
  loadAgainRequested = false;

  const userId = currentUser.id;
  const generation = authGeneration;

  expenseList.textContent = "Loading expenses...";

  try {
    const { data, error } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (generation !== authGeneration || currentUser?.id !== userId) {
      return;
    }

    if (error) {
      expenseList.textContent = "Could not load expenses.";
      showAppMessage(error.message, true);
      return;
    }

    const records = data || [];

    expenses = records.filter((expense) => !expense.is_archived);
    archivedExpenses = records.filter((expense) => expense.is_archived);

    renderExpenses();
    renderArchive();
  } catch (error) {
    if (generation === authGeneration) {
      expenseList.textContent = "Could not load expenses.";
      showAppMessage(error.message || "Could not load expenses.", true);
    }
  } finally {
    loadingExpenses = false;

    if (loadAgainRequested && currentUser) {
      loadAgainRequested = false;
      loadExpenses();
    }
  }
}


// Calculate the overall, weekly, and monthly totals.
function renderSummary() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const weekly = expenses.filter((expense) =>
    isSameDateRange(expense.expense_date, weekStart, weekEnd)
  );

  const monthly = expenses.filter((expense) => {
    const date = expense.expense_date;
    return date >= dateString(monthStart) && date <= dateString(monthEnd);
  });

  document.getElementById("total-expenses").textContent =
    formatCurrency(sumExpenses(expenses));

  document.getElementById("weekly-expenses").textContent =
    formatCurrency(sumExpenses(weekly));

  document.getElementById("monthly-expenses").textContent =
    formatCurrency(sumExpenses(monthly));

  document.getElementById("expense-count").textContent = expenses.length;

  document.getElementById("weekly-caption").textContent =
    dateRangeLabel(weekStart, weekEnd);

  document.getElementById("monthly-caption").textContent =
    now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// Build table cells safely, without inserting user text as HTML.
function createCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function renderExpenses() {
  renderSummary();

  const filter = document.getElementById("filter-category").value;
  const filteredExpenses = filter === "All"
    ? expenses
    : expenses.filter((expense) => expense.category === filter);

  document.getElementById("history-caption").textContent =
    `${filteredExpenses.length} record${filteredExpenses.length === 1 ? "" : "s"}`;

  expenseList.replaceChildren();

  if (filteredExpenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = expenses.length === 0
      ? "No expenses yet. Add your first expense above!"
      : "No expenses match this category.";
    expenseList.appendChild(empty);
    return;
  }

  // Group records by the Monday date of their week.
  const groups = new Map();

  filteredExpenses.forEach((expense) => {
    const monday = startOfWeek(parseLocalDate(expense.expense_date));
    const key = dateString(monday);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(expense);
  });

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  sortedKeys.forEach((weekKey) => {
    const weekExpenses = groups.get(weekKey);
    const weekStart = parseLocalDate(weekKey);
    const weekEnd = endOfWeek(weekStart);
    const weekTotal = sumExpenses(weekExpenses);

    const block = document.createElement("section");
    block.className = "week-block";

    const heading = document.createElement("div");
    heading.className = "week-heading";

    const headingText = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `Week of ${formatDate(weekKey)}`;

    const range = document.createElement("p");
    range.textContent = dateRangeLabel(weekStart, weekEnd);

    headingText.append(title, range);

    const total = document.createElement("div");
    total.className = "week-total";
    total.textContent = formatCurrency(weekTotal);

    heading.append(headingText, total);

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "expense-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    ["Date", "Item / Notes", "Category", "Amount", "Actions"].forEach((label) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");

    weekExpenses.forEach((expense) => {
      const row = document.createElement("tr");

      row.appendChild(createCell(formatDate(expense.expense_date)));

      const itemCell = createCell("");
      const itemText = document.createElement("div");
      itemText.className = "table-item";
      itemText.textContent = expense.item;
      itemCell.appendChild(itemText);

      if (expense.notes) {
        const notes = document.createElement("span");
        notes.className = "table-notes";
        notes.textContent = expense.notes;
        itemCell.appendChild(notes);
      }
      row.appendChild(itemCell);

      row.appendChild(createCell(expense.category));
      row.appendChild(createCell(formatCurrency(Number(expense.amount)), "table-amount"));

      const actionCell = createCell("");
      const actions = document.createElement("div");
      actions.className = "table-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editExpense(expense));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteExpense(expense));

      actions.append(editButton, deleteButton);
      actionCell.appendChild(actions);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });

    table.append(thead, tbody);
    tableWrap.appendChild(table);

    const footer = document.createElement("div");
    footer.className = "week-footer";

    const count = document.createElement("span");
    count.textContent = `${weekExpenses.length} expense${weekExpenses.length === 1 ? "" : "s"}`;

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Weekly total: ";

    const strong = document.createElement("strong");
    strong.textContent = formatCurrency(weekTotal);
    totalLabel.appendChild(strong);

    footer.append(count, totalLabel);
    block.append(heading, tableWrap, footer);
    expenseList.appendChild(block);
  });
}

// Edit an existing record.
function editExpense(expense) {
  editingExpenseId = expense.id;

  document.getElementById("expense-item").value = expense.item;
  document.getElementById("expense-amount").value = expense.amount;
  document.getElementById("expense-category").value = expense.category;
  document.getElementById("expense-date").value = expense.expense_date;
  document.getElementById("expense-notes").value = expense.notes || "";

  document.getElementById("expense-form-title").textContent = "Edit expense";
  document.getElementById("save-expense-button").textContent = "Update expense →";
  document.getElementById("cancel-edit-button").hidden = false;

  document.getElementById("expense-form-title").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showAppMessage("Change the details and select Update expense.");
}

// Delete a record.
async function deleteExpense(expense) {
  if (!currentUser) return;

  if (!window.confirm(`Delete "${expense.item}" for ${formatCurrency(Number(expense.amount))}?`)) {
    return;
  }

  showAppMessage("Deleting expense...");

  const { data, error } = await supabaseClient
    .from("expenses")
    .delete()
    .eq("id", expense.id)
    .eq("user_id", currentUser.id)
    .select("id");

  if (error) {
    showAppMessage(error.message, true);
    return;
  }

  if (!data || data.length === 0) {
    showAppMessage("The expense was not deleted. Please refresh and try again.", true);
    return;
  }

  if (editingExpenseId === expense.id) {
    resetExpenseForm();
  }

  showAppMessage("Expense deleted.");
  await loadExpenses();
}

document.getElementById("filter-category").addEventListener("change", renderExpenses);

document.getElementById("refresh-button").addEventListener("click", async () => {
  showAppMessage("");
  await loadExpenses();
});

function getArchiveCutoffDate() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - 8);
  return dateString(cutoff);
}

function renderArchive() {
  const archiveList = document.getElementById("archive-list");
  const count = document.getElementById("archived-count");

  count.textContent = archivedExpenses.length;
  archiveList.replaceChildren();

  if (archivedExpenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No archived expenses yet.";
    archiveList.appendChild(empty);
    return;
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "expense-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  ["Date", "Item", "Category", "Amount", "Action"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");

  archivedExpenses.forEach((expense) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(formatDate(expense.expense_date)));
    row.appendChild(createCell(expense.item));
    row.appendChild(createCell(expense.category));
    row.appendChild(
      createCell(formatCurrency(Number(expense.amount)), "table-amount")
    );

    const actionCell = createCell("");
    const restoreButton = document.createElement("button");

    restoreButton.type = "button";
    restoreButton.textContent = "Restore";
    restoreButton.addEventListener("click", () => restoreExpense(expense));

    actionCell.appendChild(restoreButton);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  archiveList.appendChild(tableWrap);
}

document
  .getElementById("archive-old-button")
  .addEventListener("click", archiveOldExpenses);

async function archiveOldExpenses() {
  if (!currentUser) return;

  const cutoff = getArchiveCutoffDate();

  const eligible = expenses.filter(
    (expense) => expense.expense_date < cutoff
  );

  if (eligible.length === 0) {
    document.getElementById("archive-message").textContent =
      "No active expenses are older than 8 months.";
    return;
  }

  const confirmed = window.confirm(
    `Move ${eligible.length} expense(s) dated before ${formatDate(cutoff)} ` +
    "to the archive? They will not be deleted."
  );

  if (!confirmed) return;

  const message = document.getElementById("archive-message");
  message.textContent = "Archiving older expenses...";

  const ids = eligible.map((expense) => expense.id);

  const { data, error } = await supabaseClient
    .from("expenses")
    .update({ is_archived: true })
    .eq("user_id", currentUser.id)
    .eq("is_archived", false)
    .in("id", ids)
    .select("id");

  if (error) {
    message.textContent = "Could not archive expenses: " + error.message;
    return;
  }

  if (!data || data.length !== ids.length) {
    message.textContent =
      "Some records were not archived. Refreshing the expense list.";
    await loadExpenses();
    return;
  }

  message.textContent = `${data.length} expense(s) moved to the archive.`;
  await loadExpenses();
}

async function restoreExpense(expense) {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("expenses")
    .update({ is_archived: false })
    .eq("id", expense.id)
    .eq("user_id", currentUser.id)
    .eq("is_archived", true)
    .select("id");

  if (error) {
    document.getElementById("archive-message").textContent =
      "Could not restore expense: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById("archive-message").textContent =
      "The expense was not restored. Refresh and try again.";
    return;
  }

  document.getElementById("archive-message").textContent =
    `"${expense.item}" restored to your expense history.`;

  await loadExpenses();
}

// Restore an existing session on page load.
async function initializeApp() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showAuthMessage(error.message, true);
    return;
  }

  if (data.session) {
    await displayDashboard(data.session.user);
  }
}

// Handle authentication changes without doing async work inside the callback.
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    expenses = [];
    editingExpenseId = null;
    authGeneration++;

    dashboard.hidden = true;
    authSection.hidden = false;
    renderExpenses();
    return;
  }

  if (event === "SIGNED_IN" && session?.user && currentUser?.id !== session.user.id) {
    // Defer until after the auth callback completes.
    setTimeout(() => {
      if (session.user && currentUser?.id !== session.user.id) {
        displayDashboard(session.user);
      }
    }, 0);
  }
});

document.getElementById("expense-date").value = todayLocal();
initializeApp();
