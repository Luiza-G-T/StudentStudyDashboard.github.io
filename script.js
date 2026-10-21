
console.log("Study dahsboard JavaScript loaded");
const timerDisplay = document.getElementById("timer");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");

const subjectSelect = document.getElementById("subjectSelect");
const totalStudyTime = document.getElementById("totalStudyTime");
const progressFill = document.getElementById("progressFill");

const sessionsList = document.getElementById("sessionsList");

const todoInput = document.getElementById("todoInput");
const addTodoButton = document.getElementById("addTodoButton");
const todoList = document.getElementById("todoList");

const currentDate = document.getElementById("currentDate");

/*Time Variable Section */

const startingMinutes = 25;
const dailyGoalMinutes =120;

let timeRemaining = startingMinutes * 60;
let timeInterval = null;
let timerRunning = false;
let sessionStartTime = null;

/*Date and storage set up*/

function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const todayKey = getTodayKey();
const sessionsStorageKey = `studySessions-${todayKey}`;
const tasksStorageKey = "studyDashboardTasks";

function loadData(key, fallback) {
    try{
        const savedData = localStorage.getItem(key);
        return savedData ? JSON.parse(savedData) : fallback;
    } catch (error) {
        console.error("COuld not load saved data: ", error);
        return fallback;
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error("Could not save data: ", error);
    }
}

let studySessions = loadData(sessionsStorageKey, []);
let tasks = loadData(tasksStorageKey, []);

/*Display Current Date*/

function displayDate(){
    const today = new Date();
    const options={
        weekday:"long",
        day:"numeric",
        month:"long",
        year:"numeric"
    };
    currentDate.textContent = today.toLocaleDateString("en-GB", options);
}
displayDate();

/*Update Timer Display*/

function updateTimerDisplay(){
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(seconds).padStart(2, "0");

    timerDisplay.textContent=`${formattedMinutes}:${formattedSeconds}`;
}

updateTimerDisplay();

/*Starting the Timer*/

function startTimer() {

    if (timerRunning) {
        return;
    }
    if (timeRemaining <= 0) {
        return;
    }

    timerRunning = true;
    sessionStartTime = Date.now();
    timerInterval = setInterval(function () {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            timerRunning = false;
            sessionStartTime = null;
            completeStudySession();
        }
    }, 1000);
}


/*pausing the Timer*/
function pauseTimer() {
    if (!timerRunning) {
        return;
    }

    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;
    sessionStartTime = null;
}


/*Resetting the Timer*/

function resetTimer() {
    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;
    sessionStartTime = null;

    timeRemaining = startingMinutes * 60;

    updateTimerDisplay();
}

/*Completing study session*/
function completeStudySession() {
    const selectedSubject = subjectSelect.value;

    const session = {
        subject: selectedSubject,
        duration: startingMinutes,
        time: new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit"
        })
    };
    studySessions.unshift(session);
    saveData(sessionsStorageKey, studySessions);
    updateProgress();
    renderStudySessions();
    alert(`Well done! You completed 25 minutes of ${selectedSubject} study.`);
    timeRemaining = startingMinutes * 60;
    updateTimerDisplay();
}

/*Tracking study progress */

function updateProgress() {
    const totalMinutes = studySessions.reduce(
        (total, session) => total + session.duration,
        0
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    totalStudyTime.textContent = `${hours}h ${minutes}m`;
    const percentage = Math.min(
        (totalMinutes / dailyGoalMinutes) * 100,
        100
    );

    progressFill.style.width = `${percentage}%`;
    progressFill.setAttribute(
        "role",
        "progressbar"
    );

    progressFill.setAttribute("aria-valuemin","0");
    progressFill.setAttribute( "aria-valuemax","100");
    progressFill.setAttribute("aria-valuenow",String(Math.round(percentage)));

    const goalText = document.querySelector(".goal-text");
    if (goalText) {
        if (totalMinutes >= dailyGoalMinutes) {
            goalText.textContent =
                "Daily goal completed! Amazing work!";
        } else {
            const remainingMinutes = dailyGoalMinutes - totalMinutes;
            goalText.textContent =
                `Daily goal: 2 hours (${remainingMinutes} minutes remaining)`;
        }
     }
}

/*Display daily study session*/

function renderStudySessions() {
    sessionsList.replaceChildren();
    if (studySessions.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-message";
        emptyMessage.textContent = "No study sessions yet. Start your first session!";
        sessionsList.appendChild(emptyMessage);
        return;
    }

/*Display completed sessions*/
    studySessions.forEach(function (session) {
        const sessionElement = document.createElement("div");
        sessionElement.className = "session";

        const sessionInfo = document.createElement("div");

        const subjectElement = document.createElement("p");
        subjectElement.className = "session-subject";
        subjectElement.textContent = session.subject;

        const timeElement = document.createElement("p");
        timeElement.className = "session-time";
        timeElement.textContent = `Completed at ${session.time}`;

        const durationElement = document.createElement("span");
        durationElement.className = "session-duration";
        durationElement.textContent = `${session.duration} min`;

        sessionInfo.appendChild(subjectElement);
        sessionInfo.appendChild(timeElement);
        sessionElement.appendChild(sessionInfo);
        sessionElement.appendChild(durationElement);
        sessionsList.appendChild(sessionElement);
    });
}


/*Adding new tasks*/

function addTodo() {
    const taskText = todoInput.value.trim();
    if (taskText === "") {
        todoInput.focus();
        return;
    }

    const task = {
        id: Date.now() + Math.random(),
        text: taskText,
        completed: false
    };

    tasks.push(task);
    saveData(tasksStorageKey, tasks);
    renderTodos();
    todoInput.value = "";
    todoInput.focus();
}

/*Display to do list*/

function renderTodos() {
    todoList.replaceChildren();
    if (tasks.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No tasks yet. Add your first task!";
        emptyItem.style.justifyContent = "center";
        emptyItem.style.color = "#9997a8";
        todoList.appendChild(emptyItem);
        return;
    }

    tasks.forEach(function (task) {
        const listItem = document.createElement("li");
        const leftContainer = document.createElement("div");
        leftContainer.className = "todo-left";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute(
            "aria-label",
            `Mark ${task.text} as completed`
        );

        const taskText = document.createElement("span");
        taskText.textContent = task.text;
        if (task.completed) {
            taskText.classList.add("completed");
        }

        checkbox.addEventListener("change", function () {
            task.completed = checkbox.checked;
            saveData(tasksStorageKey, tasks);
            renderTodos();
        });

        const deleteButton = document.createElement("button");

        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.textContent = "✕";
        deleteButton.setAttribute("aria-label",`Delete task: ${task.text}`);

        deleteButton.addEventListener("click", function () {
            tasks = tasks.filter(function (item) {
                return item.id !== task.id;
            });
            saveData(tasksStorageKey, tasks);
            renderTodos();
        });

        leftContainer.appendChild(checkbox);
        leftContainer.appendChild(taskText);
        listItem.appendChild(leftContainer);
        listItem.appendChild(deleteButton);
        todoList.appendChild(listItem);
    });
}

/*timer buttond*/

console.log("Connecting dashboard buttons...");

startButton.addEventListener("click", function () {
    console.log("Start button clicked!");
    startTimer();
});

pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);
addTodoButton.addEventListener("click", addTodo);

todoInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        addTodo();
    }
});

renderTodos();
renderStudySessions();
updateProgress();
updateTimerDisplay();

console.log("Dashboard initialised successfully!");
