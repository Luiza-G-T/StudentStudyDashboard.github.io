// supabase links

const SUPABASE_URL = "https://vctymsyhemtsczzctofi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wKGUM0dtLFQHBm2wrJ1ArQ_8YOerQGw";

const supabaseReady = window.supabase &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// html

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const logoutButton = document.getElementById("logoutButton");
const accountEmail = document.getElementById("accountEmail");
const welcomeGreeting = document.getElementById("welcomeGreeting");
const saveStatus = document.getElementById("saveStatus");

const timerDisplay = document.getElementById("timer");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const subjectSelect = document.getElementById("subjectSelect");
const totalStudyTime = document.getElementById("totalStudyTime");
const progressFill = document.getElementById("progressFill");
const goalText = document.getElementById("goalText");
const sessionsList = document.getElementById("sessionsList");
const todoInput = document.getElementById("todoInput");
const todoForm = document.getElementById("todoForm");
const todoList = document.getElementById("todoList");
const currentDate = document.getElementById("currentDate");


const STARTING_MINUTES = 25;
const DAILY_GOAL_MINUTES = 120;

let currentUser = null;
let authMode = "login";
let timeRemaining = STARTING_MINUTES * 60;
let timerInterval = null;
let timerRunning = false;
let appData = {
  sessions: [],
  tasksByDate: {}
};
let saveQueue = Promise.resolve();
let saveDebounce = null;
let saveVersion = 0;

function todayKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function showAuthMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", success);
}

function setSaveMessage(message) {
  saveStatus.textContent = message;
}

function errorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function normalizeData(data) {
  return {
    sessions: Array.isArray(data?.sessions)
      ? data.sessions
      : [],
    tasksByDate:
      data?.tasksByDate &&
      typeof data.tasksByDate === "object" &&
      !Array.isArray(data.tasksByDate)
        ? data.tasksByDate
        : {}
  };
}

function getTodayTasks() {
  const key = todayKey();

  if (!Array.isArray(appData.tasksByDate[key])) {
    appData.tasksByDate[key] = [];
  }

  return appData.tasksByDate[key];
}

function getTodaySessions() {
  return appData.sessions.filter(
    session => session.date === todayKey()
  );
}

// log in and signup

function setAuthMode(mode) {
  authMode = mode;

  const signup = mode === "signup";

  authTitle.textContent = signup
    ? "Create your account"
    : "Welcome back";

  authSubtitle.textContent = signup
    ? "Create an account to save your study progress."
    : "Log in to continue your progress.";

  authSubmit.textContent = signup
    ? "Create account"
    : "Log in";

  passwordInput.autocomplete = signup
    ? "new-password"
    : "current-password";

  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);

  showAuthMessage("");
}

loginTab.addEventListener("click", () => setAuthMode("login"));
signupTab.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    showAuthMessage(
      "Please configure your Supabase URL and public key in script.js."
    );
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  authSubmit.disabled = true;

  showAuthMessage(
    authMode === "signup"
      ? "Creating your account..."
      : "Logging in..."
  );

  try {
    if (authMode === "signup") {
      const { data, error } = await db.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.session && data.user) {
        await enterDashboard(data.user);
      } else {
        setAuthMode("login");
        emailInput.value = email;

        showAuthMessage(
          "Account created! Check your email to confirm your address, then log in.",
          true
        );
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        await enterDashboard(data.user);
      }
    }
  } catch (error) {
    showAuthMessage(errorMessage(error));
  } finally {
    authSubmit.disabled = false;
  }
});

// dashboard code

async function enterDashboard(user) {
  if (!db || !user) return;

  currentUser = user;

  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  accountEmail.textContent = user.email || "Student";
  welcomeGreeting.textContent = "Welcome back!";

  displayDate();
  setSaveMessage("Loading your saved progress...");

  try {
    const { data, error } = await db
      .from("study_data")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!currentUser || currentUser.id !== user.id) return;

    appData = normalizeData(data?.data || {});

    renderTodos();
    renderStudySessions();
    updateProgress();
    setSaveMessage("Your progress is synced to your account.");
  } catch (error) {
    setSaveMessage(
      `Couldn't load saved progress: ${errorMessage(error)}`
    );
  }
}

// logout

logoutButton.addEventListener("click", async () => {
  if (!db || !currentUser) return;

  logoutButton.disabled = true;

  try {
    await flushSave();

    const { error } = await db.auth.signOut();

    if (error) throw error;

    stopTimer();

    currentUser = null;
    appData = {
      sessions: [],
      tasksByDate: {}
    };

    timeRemaining = STARTING_MINUTES * 60;
    updateTimerDisplay();

    dashboardView.classList.add("hidden");
    authView.classList.remove("hidden");

    passwordInput.value = "";
    emailInput.value = "";

    setAuthMode("login");
    showAuthMessage("You have logged out successfully.", true);
  } catch (error) {
    setSaveMessage(
      `Logout failed: ${errorMessage(error)}`
    );
  } finally {
    logoutButton.disabled = false;
  }
});

//saving sdata tp supabase

function queueSave() {
  if (!db || !currentUser) return;

  const version = ++saveVersion;

  setSaveMessage("Saving your progress...");

  clearTimeout(saveDebounce);

  saveDebounce = setTimeout(() => {
    saveDataNow(version);
  }, 350);
}

async function saveDataNow(version = saveVersion) {
  if (!db || !currentUser) return;

  const userId = currentUser.id;
  const snapshot = JSON.parse(JSON.stringify(appData));
  const job = saveQueue.then(async () => {
    if (!currentUser || currentUser.id !== userId) return;
    const { error } = await db
      .from("study_data")
      .upsert(
        {
          user_id: userId,
          data: snapshot,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
    if (
      currentUser &&
      currentUser.id === userId &&
      version === saveVersion
    ) {
      setSaveMessage("All changes saved.");
    }
  });

 
  saveQueue = job.catch(error => {
    console.error("Save failed:", error);

    if (currentUser && currentUser.id === userId) {
      setSaveMessage(
        `Save failed: ${errorMessage(error)}. Check your connection.`
      );
    }
  });

  await saveQueue;
}

async function flushSave() {
  clearTimeout(saveDebounce);

  if (!db || !currentUser) return;

  await saveDataNow(++saveVersion);
  await saveQueue;
}


// date and timer code

function displayDate() {
  currentDate.textContent = new Date().toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  if (!currentUser || timerRunning || timeRemaining <= 0) {
    return;
  }

  timerRunning = true;

  timerInterval = setInterval(() => {
    if (timeRemaining > 0) {
      timeRemaining--;
      updateTimerDisplay();
    }

    if (timeRemaining <= 0) {
      stopTimer();
      completeStudySession();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = null;
  timerRunning = false;
}

function pauseTimer() {
  stopTimer();
}

function resetTimer() {
  stopTimer();
  timeRemaining = STARTING_MINUTES * 60;
  updateTimerDisplay();
}

function completeStudySession() {
  if (!currentUser) return;

  const now = new Date();

  appData.sessions.unshift({
    id: newId(),
    date: todayKey(),
    subject: subjectSelect.value,
    duration: STARTING_MINUTES,
    time: now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    })
  });

  queueSave();
  updateProgress();
  renderStudySessions();

  alert(
    `Well done! You completed 25 minutes of ${subjectSelect.value} study.`
  );

  timeRemaining = STARTING_MINUTES * 60;
  updateTimerDisplay();
}

// daily progress code

function updateProgress() {
  const totalMinutes = getTodaySessions().reduce(
    (total, session) =>
      total + (Number(session.duration) || 0),
    0
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  totalStudyTime.textContent = `${hours}h ${minutes}m`;

  const percentage = Math.min(
    (totalMinutes / DAILY_GOAL_MINUTES) * 100,
    100
  );

  progressFill.style.width = `${percentage}%`;
  progressFill.setAttribute("role", "progressbar");
  progressFill.setAttribute("aria-valuemin", "0");
  progressFill.setAttribute("aria-valuemax", "100");
  progressFill.setAttribute(
    "aria-valuenow",
    String(Math.round(percentage))
  );

  goalText.textContent =
    totalMinutes >= DAILY_GOAL_MINUTES
      ? "Daily goal completed! Amazing work!"
      : `Daily goal: 2 hours (${DAILY_GOAL_MINUTES - totalMinutes} minutes remaining)`;
}

//study sessions code

function renderStudySessions() {
  sessionsList.replaceChildren();

  const sessions = getTodaySessions();

  if (sessions.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent =
      "No study sessions yet. Start your first session!";

    sessionsList.appendChild(message);
    return;
  }

  sessions.forEach(session => {
    const row = document.createElement("div");
    row.className = "session";

    const info = document.createElement("div");

    const subject = document.createElement("p");
    subject.className = "session-subject";
    subject.textContent = session.subject || "General";

    const time = document.createElement("p");
    time.className = "session-time";
    time.textContent = `Completed at ${session.time || "—"}`;

    const duration = document.createElement("span");
    duration.className = "session-duration";
    duration.textContent =
      `${Number(session.duration) || 0} min`;

    info.append(subject, time);
    row.append(info, duration);
    sessionsList.appendChild(row);
  });
}

//add tasks code

function addTodo(event) {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (!text || !currentUser) {
    todoInput.focus();
    return;
  }

  getTodayTasks().push({
    id: newId(),
    text,
    completed: false
  });

  queueSave();
  renderTodos();
  todoInput.value = "";
  todoInput.focus();
}

//edit tasks code

function renderTodos() {
  todoList.replaceChildren();

  const tasks = getTodayTasks();

  if (tasks.length === 0) {
    const item = document.createElement("li");

    item.textContent = "No tasks yet. Add your first task!";
    item.style.justifyContent = "center";
    item.style.color = "#9997a8";

    todoList.appendChild(item);
    return;
  }

  tasks.forEach(task => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "todo-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute(
      "aria-label",
      `Mark ${task.text} as completed`
    );

    const text = document.createElement("span");
    text.textContent = task.text;

    if (task.completed) {
      text.classList.add("completed");
    }

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;

      queueSave();
      renderTodos();
    });

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute(
      "aria-label",
      `Delete task: ${task.text}`
    );

    remove.addEventListener("click", () => {
      appData.tasksByDate[todayKey()] =
        getTodayTasks().filter(
          item => item.id !== task.id
        );

      queueSave();
      renderTodos();
    });

    left.append(checkbox, text);
    li.append(left, remove);
    todoList.appendChild(li);
  });
}

//buttons

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);
todoForm.addEventListener("submit", addTodo);

//initialising app

async function initializeApp() {
  updateTimerDisplay();
  displayDate();

  if (!db) {
    authSubmit.disabled = true;

    showAuthMessage(
      "Setup required: add your Supabase Project URL and anon public key in script.js."
    );

    return;
  }

  authSubmit.disabled = false;
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.user) {
      await enterDashboard(data.session.user);
    }
  } catch (error) {
    showAuthMessage(errorMessage(error));
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      stopTimer();
      currentUser = null;
      appData = {
        sessions: [],
        tasksByDate: {}
      };
      dashboardView.classList.add("hidden");
      authView.classList.remove("hidden");
    }
  });
}

initializeApp();
