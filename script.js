const API_URL = "/api";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let profile = JSON.parse(localStorage.getItem("studentProfile")) || {
  name: "Mosallama B. Tiban",
  university: "University of Southern Mindanao",
  course: "Bachelor of Science in Computer Science (BSCS)",
  studentId: "",
  about: ""
};

let grades = [];
let usingBackend = true;

function notify(message) {
  const box = $("#notification");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3500);
}

const profilePicture = document.getElementById("profilePicture");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const changePhotoButton = document.getElementById("changePhotoButton");

changePhotoButton.addEventListener("click", function () {
    profilePhotoInput.click();
});

profilePhotoInput.addEventListener("change", function () {
    const file = profilePhotoInput.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function (event) {
            profilePicture.src = event.target.result;
            localStorage.setItem("profilePicture", event.target.result);
        };

        reader.readAsDataURL(file);
    }
});

const savedPicture = localStorage.getItem("profilePicture");

if (savedPicture) {
    profilePicture.src = savedPicture;
}

function saveProfileLocally() {
  localStorage.setItem("studentProfile", JSON.stringify(profile));
}

function showPage(page) {
  $$(".page").forEach(section => section.classList.remove("active-page"));
  $(`#page-${page}`).classList.add("active-page");
  $$(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $("#pageTitle").textContent = page === "home" ? `Welcome back, ${profile.name.split(" ")[0]}!` : page[0].toUpperCase() + page.slice(1);
}

function renderProfile() {
  $("#summaryName").textContent = profile.name;
  $("#summaryUniversity").textContent = profile.university;
  $("#summaryCourse").textContent = profile.course;
  $("#profileName").value = profile.name;
  $("#profileUniversity").value = profile.university;
  $("#profileCourse").value = profile.course;
  $("#profileStudentId").value = profile.studentId || "";
  $("#profileAbout").value = profile.about || "";
  $("#pageTitle").textContent = `Welcome back, ${profile.name.split(" ")[0]}!`;
}

function calculateStats() {
  const total = grades.length;
  const completed = grades.filter(g => g.status === "Completed").length;
  const pending = grades.filter(g => g.status === "Pending" || g.status === "In Progress").length;
  const graded = grades.filter(g => Number.isFinite(Number(g.grade)));
  const average = graded.length ? graded.reduce((sum, g) => sum + Number(g.grade), 0) / graded.length : null;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  ["home", "dash"].forEach(prefix => {
    $(`#${prefix}TotalSubjects`).textContent = total;
    $(`#${prefix}CompletedSubjects`).textContent = completed;
    $(`#${prefix}PendingTasks`).textContent = pending;
    $(`#${prefix}AverageGrade`).textContent = average === null ? "—" : average.toFixed(2);
  });

  $("#progressBar").style.width = `${progress}%`;
  $("#progressText").textContent = total ? `${progress}% of your subjects are completed.` : "Add grades to see your progress.";
}

function renderGrades() {
  const body = $("#gradesTableBody");
  body.innerHTML = "";
  $("#gradeCount").textContent = `${grades.length} subject${grades.length === 1 ? "" : "s"}`;
  $("#emptyGrades").style.display = grades.length ? "none" : "block";

  grades.forEach(grade => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(grade.code)}</td>
      <td>${escapeHtml(grade.name)}</td>
      <td>${grade.grade}</td>
      <td>${escapeHtml(grade.status)}</td>
      <td>
        <button class="action-button" data-edit="${grade.id}">Edit</button>
        <button class="action-button" data-delete="${grade.id}">Delete</button>
      </td>`;
    body.appendChild(row);
  });

  $$("[data-edit]").forEach(button => button.addEventListener("click", () => editGrade(button.dataset.edit)));
  $$("[data-delete]").forEach(button => button.addEventListener("click", () => deleteGrade(button.dataset.delete)));
  calculateStats();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[character]));
}

async function loadGrades() {
  try {
    const response = await fetch(`${API_URL}/grades`);
    if (!response.ok) throw new Error("Backend unavailable");
    grades = await response.json();
    usingBackend = true;
  } catch {
    grades = JSON.parse(localStorage.getItem("studentGrades")) || [];
    usingBackend = false;
  }
  renderGrades();
}

async function saveGradeToBackend(grade, method = "POST") {
  const endpoint = method === "PUT" ? `${API_URL}/grades/${grade.id}` : `${API_URL}/grades`;
  const response = await fetch(endpoint, {
    method,
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(grade)
  });
  if (!response.ok) throw new Error("Could not save grade");
  return response.json();
}

async function deleteGradeFromBackend(id) {
  const response = await fetch(`${API_URL}/grades/${id}`, { method:"DELETE" });
  if (!response.ok) throw new Error("Could not delete grade");
}

function persistGradesLocally() {
  localStorage.setItem("studentGrades", JSON.stringify(grades));
}

function resetGradeForm() {
  $("#gradeForm").reset();
  $("#gradeId").value = "";
  $("#gradeForm").classList.add("hidden");
}

function editGrade(id) {
  const grade = grades.find(item => String(item.id) === String(id));
  if (!grade) return;
  $("#gradeId").value = grade.id;
  $("#subjectCode").value = grade.code;
  $("#subjectName").value = grade.name;
  $("#subjectGrade").value = grade.grade;
  $("#subjectStatus").value = grade.status;
  $("#gradeForm").classList.remove("hidden");
  $("#subjectCode").focus();
}

async function deleteGrade(id) {
  if (!confirm("Delete this subject?")) return;
  try {
    if (usingBackend) await deleteGradeFromBackend(id);
    grades = grades.filter(item => String(item.id) !== String(id));
    persistGradesLocally();
    renderGrades();
    notify("Subject deleted successfully.");
  } catch (error) {
    notify(error.message);
  }
}

$$("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
$$("[data-page-jump]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.pageJump)));

$("#sidebarToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("collapsed");
  document.body.classList.toggle("sidebar-collapsed");
});

$("#profileForm").addEventListener("submit", event => {
  event.preventDefault();
  profile = {
    name: $("#profileName").value.trim(),
    university: $("#profileUniversity").value.trim(),
    course: $("#profileCourse").value.trim(),
    studentId: $("#profileStudentId").value.trim(),
    about: $("#profileAbout").value.trim()
  };
  saveProfileLocally();
  renderProfile();
  notify("Profile updated successfully.");
});

$("#newGradeButton").addEventListener("click", () => {
  $("#gradeForm").classList.remove("hidden");
  $("#gradeForm").reset();
  $("#gradeId").value = "";
  $("#subjectCode").focus();
});

$("#cancelGradeButton").addEventListener("click", resetGradeForm);

$("#gradeForm").addEventListener("submit", async event => {
  event.preventDefault();
  const gradeValue = Number($("#subjectGrade").value);
  if (gradeValue < 0 || gradeValue > 100) {
    notify("Grade must be between 0 and 100.");
    return;
  }

  const existingId = $("#gradeId").value;
  const grade = {
    id: existingId || crypto.randomUUID(),
    code: $("#subjectCode").value.trim(),
    name: $("#subjectName").value.trim(),
    grade: gradeValue,
    status: $("#subjectStatus").value
  };

  try {
    if (usingBackend) {
      const saved = await saveGradeToBackend(grade, existingId ? "PUT" : "POST");
      grades = existingId ? grades.map(item => String(item.id) === String(existingId) ? saved : item) : [...grades, saved];
    } else {
      grades = existingId ? grades.map(item => String(item.id) === String(existingId) ? grade : item) : [...grades, grade];
    }
    persistGradesLocally();
    renderGrades();
    resetGradeForm();
    notify("Grade saved successfully.");
  } catch (error) {
    notify(`${error.message}. Saved locally instead.`);
    grades = existingId ? grades.map(item => String(item.id) === String(existingId) ? grade : item) : [...grades, grade];
    persistGradesLocally();
    renderGrades();
    resetGradeForm();
  }
});

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("studentTheme", theme);
}

$$("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice);
    notify(`${button.textContent} theme applied.`);
  });
});

$("#customColor").addEventListener("input", event => {
  document.documentElement.style.setProperty("--primary", event.target.value);
  localStorage.setItem("customAccent", event.target.value);
});

$("#quickThemeButton").addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "lavender" : "dark");
});

$("#resetDataButton").addEventListener("click", () => {
  if (!confirm("Reset saved profile, grades, and theme preferences?")) return;
  localStorage.clear();
  location.reload();
});

const savedTheme = localStorage.getItem("studentTheme") || "lavender";
const savedAccent = localStorage.getItem("customAccent");
applyTheme(savedTheme);
if (savedAccent) {
  document.documentElement.style.setProperty("--primary", savedAccent);
  $("#customColor").value = savedAccent;
}
renderProfile();
loadGrades();
