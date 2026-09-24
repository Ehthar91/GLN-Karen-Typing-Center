import { firebaseConfig } from "./flashcards-firebase-config.js";

const FIREBASE_VERSION = "12.19.0";
const THEME_KEY = "flashcards_brainscape_theme";
const QUIZ_DEFAULTS_KEY_PREFIX = "flashcards_quiz_defaults_v1";
const EMBEDDED_CLASSROOM_MODE = new URLSearchParams(window.location.search).get("embedded") === "classroom";

const [appModule, authModule, firestoreModule] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
]);

const { initializeApp } = appModule;
const {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} = authModule;

const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} = firestoreModule;

const state = {
  app: null,
  auth: null,
  db: null,
  user: null,
  ownedClasses: [],
  archivedClasses: [],
  archivedDecks: [],
  sharedClasses: [],
  sidebarClassOrder: [],
  sidebarMenuClassId: null,
  sidebarShareClassId: null,
  sidebarDraggedClassId: null,
  selectedClass: null,
  learners: [],
  selectedLearnerIds: new Set(),
  pendingLearnerRemoval: null,
  decks: [],
  progressMap: new Map(),
  selectedDeck: null,
  editingDeckId: null,
  selectedStudyDeckIds: new Set(),
  studySelectionDeckIds: [],
  studyMode: "standard",
  studyScope: "deck",
  sessionCards: [],
  sessionIndex: 0,
  sessionRatings: [],
  studyOrder: "progressive",
  studyDirection: "frontBack",
  pendingStudy: null,
  pendingQuiz: null,
  quizConfig: {
    questionStyle: "standard",
    template: "What is the answer for {term}?",
    direction: "frontBack",
    answerMode: "multiple",
    order: "progressive",
    inclusionMode: "count",
    questionCount: 0,
    questionCountMode: "all",
    manualCardKeys: [],
    points: 1
  },
  quizQuestions: [],
  quizIndex: 0,
  quizScore: 0,
  quizResults: [],
  quizAnswered: false,
  generatedGoogleFormsScript: "",
  generatedGoogleFormsFileName: "",
  generatedGoogleFormsQuestionCount: 0,
  copyCardsDestinationDeckId: null,
  copySourceDecks: [],
  copySourceCards: []
};

const sampleDeck = {
  name: "Bedroom Items",
  text: `Alarm Clock = နၣ်ရံၣ်ဆ့လ့
Bed = လီၢ်မံ
Bedroom = လီၢ်မံဒၢး
Blanket = ယၢ်လုး
Pillow = ခိၣ်သခၢၣ်
Curtain = ယၢ်ဘျးသဒၢ
Dresser = စီၢ်ကယၢ
Fan = နီၣ်ဝံၢ်ကသုၣ်
Mirror = မဲာ်ထံကလၤ
Hanger = နီၣ်ဘျးဆ့`
};

function showMessage(message, type = "", timeout = 4500) {
  const el = document.getElementById("globalMessage");
  el.textContent = message;
  el.className = `global-message ${type}`.trim();
  el.classList.remove("hidden");

  clearTimeout(showMessage._timer);
  if (timeout) {
    showMessage._timer = setTimeout(() => el.classList.add("hidden"), timeout);
  }
}

function showTopView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function showPanel(id) {
  document.querySelectorAll(".panel-view").forEach(v => v.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");

  if (id === "classView" && state.selectedClass?.name) {
    applyClassDocumentTitle(state.selectedClass.name);
  } else if (!["studyView", "quizView", "quizCompleteView", "completeView"].includes(id)) {
    setShareMetadataTitle("Flashcards");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parsePairs(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      let parts;
      if (line.includes("=")) parts = line.split("=");
      else if (line.includes("\t")) parts = line.split("\t");
      else if (line.includes(",")) parts = line.split(",");
      else return null;

      const front = parts.shift()?.trim();
      const back = parts.join("=").trim();

      if (!front || !back) return null;
      return { id: uid("card"), front, back };
    })
    .filter(Boolean);
}

function cardsToText(cards = []) {
  return cards.map(card => `${card.front} = ${card.back}`).join("\n");
}

function normalizeText(value) {
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

function shuffledCopy(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function classParam() {
  return new URL(window.location.href).searchParams.get("class");
}

function classNameParam() {
  return new URL(window.location.href).searchParams.get("name") || "";
}

function cleanShareTitle(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function setShareMetadataTitle(title = "Flashcards") {
  const clean = cleanShareTitle(title) || "Flashcards";
  document.title = clean;

  const ensureMeta = (selector, attr, key) => {
    let meta = document.head.querySelector(selector);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attr, key);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", clean);
  };

  ensureMeta('meta[property="og:title"]', "property", "og:title");
  ensureMeta('meta[name="twitter:title"]', "name", "twitter:title");
}

const sharedClassNameFromLink = classNameParam();
if (sharedClassNameFromLink) setShareMetadataTitle(sharedClassNameFromLink);

function buildClassShareLink(classId, displayName = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("class", classId);
  const name = cleanShareTitle(displayName);
  if (name) url.searchParams.set("name", name);
  return url.toString();
}

function classShareTitle(className = "") {
  const name = String(className || "").trim();
  return name ? `${name} — Flashcards` : "Flashcards";
}

function applyClassDocumentTitle(className = "") {
  const linkedName = classNameParam();
  setShareMetadataTitle(linkedName || classShareTitle(className));
}

function savedLinkPreviewTitle(c = state.selectedClass) {
  return cleanShareTitle(c?.linkPreviewTitle || "");
}

function linkPreviewTitleFor(c = state.selectedClass) {
  const input = document.getElementById("linkPreviewTitleInput");
  const typed = cleanShareTitle(input?.value || "");
  return typed || savedLinkPreviewTitle(c) || cleanShareTitle(c?.name || "") || "Flashcards";
}

function syncLinkPreviewTitleUi() {
  const c = state.selectedClass;
  const input = document.getElementById("linkPreviewTitleInput");
  const status = document.getElementById("linkPreviewTitleStatus");
  if (!c || !input) return;

  const saved = savedLinkPreviewTitle(c);
  input.value = saved || cleanShareTitle(c.name);
  if (status) {
    status.textContent = saved
      ? "Custom link display name saved for this class."
      : "Using the class name automatically. Type a different name to change the &name= part of the copied link.";
  }
}

async function saveLinkPreviewTitle() {
  if (!isOwner() || !state.selectedClass) return;
  const input = document.getElementById("linkPreviewTitleInput");
  const status = document.getElementById("linkPreviewTitleStatus");
  const title = cleanShareTitle(input?.value || "");

  if (!title) {
    showMessage("Enter a link display name.", "error");
    input?.focus();
    return;
  }

  try {
    await updateDoc(doc(state.db, "classes", state.selectedClass.id), {
      linkPreviewTitle: title,
      updatedAt: serverTimestamp()
    });
    state.selectedClass = { ...state.selectedClass, linkPreviewTitle: title };
    const owned = state.ownedClasses.find(c => c.id === state.selectedClass.id);
    if (owned) owned.linkPreviewTitle = title;
    if (status) status.textContent = "Custom link display name saved for this class.";
    await renderGoogleClassroomShare();
    showMessage("Link display name saved.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not save the pasted-link title.");
  }
}

async function useClassNameForLinkPreview() {
  if (!isOwner() || !state.selectedClass) return;
  const input = document.getElementById("linkPreviewTitleInput");
  const status = document.getElementById("linkPreviewTitleStatus");

  try {
    await updateDoc(doc(state.db, "classes", state.selectedClass.id), {
      linkPreviewTitle: "",
      updatedAt: serverTimestamp()
    });
    state.selectedClass = { ...state.selectedClass, linkPreviewTitle: "" };
    const owned = state.ownedClasses.find(c => c.id === state.selectedClass.id);
    if (owned) owned.linkPreviewTitle = "";
    if (input) input.value = cleanShareTitle(state.selectedClass.name);
    if (status) status.textContent = "Using the class name automatically. Type a different name to change the &name= part of the copied link.";
    await renderGoogleClassroomShare();
    showMessage("Pasted links will use the class name.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not reset the pasted-link title.");
  }
}

function savedClassroomShareTitle(c = state.selectedClass) {
  return String(c?.classroomShareTitle || "").replace(/\s+/g, " ").trim();
}

function classroomShareTitleFor(c = state.selectedClass) {
  const input = document.getElementById("classroomShareTitleInput");
  const typed = String(input?.value || "").replace(/\s+/g, " ").trim();
  return typed || savedClassroomShareTitle(c) || classShareTitle(c?.name || "");
}

function syncClassroomShareTitleUi() {
  const c = state.selectedClass;
  const input = document.getElementById("classroomShareTitleInput");
  const status = document.getElementById("classroomShareTitleStatus");
  if (!c || !input) return;

  const saved = savedClassroomShareTitle(c);
  input.value = saved || cleanShareTitle(c.name);
  if (status) {
    status.textContent = saved
      ? "Custom title saved for this class."
      : "Using the class name automatically. Type a different title anytime.";
  }
}

let classroomShareRenderTimer = null;
function scheduleClassroomShareRender() {
  clearTimeout(classroomShareRenderTimer);
  classroomShareRenderTimer = setTimeout(() => renderGoogleClassroomShare(), 250);
}

async function saveClassroomShareTitle() {
  if (!isOwner() || !state.selectedClass) return;
  const input = document.getElementById("classroomShareTitleInput");
  const status = document.getElementById("classroomShareTitleStatus");
  const title = String(input?.value || "").replace(/\s+/g, " ").trim();

  if (!title) {
    showMessage("Enter a Google Classroom share title.", "error");
    input?.focus();
    return;
  }

  try {
    await updateDoc(doc(state.db, "classes", state.selectedClass.id), {
      classroomShareTitle: title,
      updatedAt: serverTimestamp()
    });
    state.selectedClass = { ...state.selectedClass, classroomShareTitle: title };
    const owned = state.ownedClasses.find(c => c.id === state.selectedClass.id);
    if (owned) owned.classroomShareTitle = title;
    if (status) status.textContent = "Custom title saved for this class.";
    await renderGoogleClassroomShare();
    showMessage("Google Classroom share title saved.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not save the Google Classroom share title.");
  }
}

async function useClassNameForClassroomShare() {
  if (!isOwner() || !state.selectedClass) return;
  const input = document.getElementById("classroomShareTitleInput");
  const status = document.getElementById("classroomShareTitleStatus");

  try {
    await updateDoc(doc(state.db, "classes", state.selectedClass.id), {
      classroomShareTitle: "",
      updatedAt: serverTimestamp()
    });
    state.selectedClass = { ...state.selectedClass, classroomShareTitle: "" };
    const owned = state.ownedClasses.find(c => c.id === state.selectedClass.id);
    if (owned) owned.classroomShareTitle = "";
    if (input) input.value = classShareTitle(state.selectedClass.name);
    if (status) status.textContent = "Using the class name automatically. Type a different title anytime.";
    await renderGoogleClassroomShare();
    showMessage("Google Classroom will use the class name.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not reset the Google Classroom share title.");
  }
}

let classroomShareApiPromise = null;

function loadClassroomShareApi() {
  if (window.gapi?.sharetoclassroom?.render) return Promise.resolve(window.gapi.sharetoclassroom);
  if (classroomShareApiPromise) return classroomShareApiPromise;

  classroomShareApiPromise = new Promise((resolve, reject) => {
    window.___gcfg = { ...(window.___gcfg || {}), parsetags: "explicit" };

    const finish = () => {
      let tries = 0;
      const waitForApi = () => {
        if (window.gapi?.sharetoclassroom?.render) {
          resolve(window.gapi.sharetoclassroom);
          return;
        }
        tries += 1;
        if (tries > 50) {
          classroomShareApiPromise = null;
          reject(new Error("Google Classroom share button did not load."));
          return;
        }
        setTimeout(waitForApi, 100);
      };
      waitForApi();
    };

    const existing = document.querySelector('script[data-gln-classroom-share="1"]');
    if (existing) {
      if (window.gapi?.sharetoclassroom?.render) resolve(window.gapi.sharetoclassroom);
      else existing.addEventListener("load", finish, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/platform.js";
    script.async = true;
    script.defer = true;
    script.dataset.glnClassroomShare = "1";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      classroomShareApiPromise = null;
      reject(new Error("Could not load Google Classroom sharing."));
    }, { once: true });
    document.head.appendChild(script);
  });

  return classroomShareApiPromise;
}

async function renderGoogleClassroomShare() {
  const wrap = document.getElementById("classroomShareAction");
  const host = document.getElementById("classroomShareWidget");
  const c = state.selectedClass;
  const visible = Boolean(c && isOwner() && c.published !== false);

  wrap?.classList.toggle("hidden", !visible);
  if (!visible || !host) return;

  host.replaceChildren();

  try {
    const shareApi = await loadClassroomShareApi();
    if (!state.selectedClass || state.selectedClass.id !== c.id || !isOwner() || state.selectedClass.published === false) return;

    shareApi.render(host, {
      url: buildClassShareLink(c.id, linkPreviewTitleFor(c)),
      title: classroomShareTitleFor(c),
      body: `Study the flashcards for ${c.name}.`,
      itemtype: "material",
      size: "32",
      theme: "classic"
    });
  } catch (err) {
    wrap?.classList.add("classroom-share-unavailable");
    host.textContent = "Unavailable";
  }
}

function clearClassParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("class");
  url.searchParams.delete("name");
  url.searchParams.delete("preview"); // remove legacy pasted-link preview parameter if present
  history.replaceState({}, "", url);
}

function isOwner() {
  return Boolean(state.selectedClass && state.user && state.selectedClass.ownerId === state.user.uid);
}

function quizDefaultsStorageKey() {
  const uid = String(state.user?.uid || "teacher");
  return `${QUIZ_DEFAULTS_KEY_PREFIX}:${uid}`;
}

function readQuizDefaults() {
  if (!isOwner()) return null;

  try {
    const raw = localStorage.getItem(quizDefaultsStorageKey());
    if (!raw) return null;

    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;

    const allowed = {
      questionStyle: new Set(["standard", "custom"]),
      direction: new Set(["frontBack", "backFront", "mixed"]),
      answerMode: new Set(["multiple", "typed", "mixed"]),
      order: new Set(["progressive", "random"]),
      inclusionMode: new Set(["count", "manual"]),
      questionCountMode: new Set(["all", "fixed"])
    };

    const defaults = {
      questionStyle: allowed.questionStyle.has(saved.questionStyle) ? saved.questionStyle : "standard",
      template: typeof saved.template === "string" && saved.template.trim()
        ? saved.template.trim()
        : "What is the answer for {term}?",
      direction: allowed.direction.has(saved.direction) ? saved.direction : "frontBack",
      answerMode: allowed.answerMode.has(saved.answerMode) ? saved.answerMode : "multiple",
      order: allowed.order.has(saved.order) ? saved.order : "progressive",
      inclusionMode: allowed.inclusionMode.has(saved.inclusionMode) ? saved.inclusionMode : "count",
      questionCountMode: allowed.questionCountMode.has(saved.questionCountMode)
        ? saved.questionCountMode
        : "fixed",
      questionCount: Math.max(1, Math.floor(Number(saved.questionCount) || 1)),
      points: Math.max(0, Math.min(100, Number(saved.points ?? 1)))
    };

    return defaults;
  } catch (err) {
    console.warn("Could not read quiz defaults", err);
    return null;
  }
}

function updateQuizDefaultControls(hasSavedDefault = Boolean(readQuizDefaults())) {
  const controls = document.getElementById("quizDefaultControls");
  const status = document.getElementById("quizDefaultStatus");
  const resetButton = document.getElementById("resetQuizDefaultBtn");
  if (!controls) return;

  controls.classList.toggle("hidden", !isOwner());
  if (!isOwner()) return;

  if (status) {
    status.textContent = hasSavedDefault
      ? "Your saved quiz setup loads automatically on this device."
      : "No custom default saved yet. The built-in quiz setup is being used.";
  }
  if (resetButton) resetButton.disabled = !hasSavedDefault;
}

function saveQuizDefaults() {
  if (!isOwner()) return;

  syncQuizSetupInputs();

  if (state.quizConfig.questionStyle === "custom") {
    if (!state.quizConfig.template || !state.quizConfig.template.includes("{term}")) {
      showMessage('Custom questions must include {term} before saving a default.', "error");
      return;
    }
  }

  const payload = {
    questionStyle: state.quizConfig.questionStyle,
    template: state.quizConfig.template || "What is the answer for {term}?",
    direction: state.quizConfig.direction,
    answerMode: state.quizConfig.answerMode,
    order: state.quizConfig.order,
    inclusionMode: state.quizConfig.inclusionMode,
    questionCountMode: state.quizConfig.questionCountMode || "fixed",
    questionCount: Math.max(1, Math.floor(Number(state.quizConfig.questionCount) || 1)),
    points: Math.max(0, Math.min(100, Number(state.quizConfig.points ?? 1)))
  };

  try {
    localStorage.setItem(quizDefaultsStorageKey(), JSON.stringify(payload));
    updateQuizDefaultControls(true);
    showMessage("Quiz setup saved as your default.", "success");
  } catch (err) {
    console.warn("Could not save quiz defaults", err);
    showMessage("This browser could not save your quiz default.", "error");
  }
}

function resetQuizDefaults() {
  if (!isOwner()) return;

  try {
    localStorage.removeItem(quizDefaultsStorageKey());
    updateQuizDefaultControls(false);
    showMessage("Quiz default reset. Built-in settings will be used next time.", "success");
  } catch (err) {
    console.warn("Could not reset quiz defaults", err);
    showMessage("This browser could not reset your quiz default.", "error");
  }
}

function isGuestStudent() {
  return Boolean(state.user?.isAnonymous);
}

function guestStudentName() {
  if (!isGuestStudent()) return state.user?.displayName || "";
  const suffix = String(state.user?.uid || "guest").slice(-4).toUpperCase();
  return `Guest ${suffix}`;
}

function applyGuestStudyUi() {
  const guest = isGuestStudent();
  document.body.classList.toggle("guest-study-mode", guest);

  const name = document.getElementById("sidebarName");
  if (guest && name) name.textContent = "Guest Student";

  const signOutButton = document.getElementById("signOutBtn");
  if (signOutButton) signOutButton.textContent = guest ? "Exit Guest Study" : "Sign out";
}

function progressDocId(classId, deckId, studentId) {
  return `${classId}_${deckId}_${studentId}`;
}

function progressStats(progress) {
  if (!progress) {
    return { studied: 0, unique: 0, ratingCount: 0, ratingTotal: 0, avg: 0, mastery: 0 };
  }

  const ratingCount = Number(progress.ratingCount || 0);
  const ratingTotal = Number(progress.ratingTotal || 0);
  const avg = ratingCount ? ratingTotal / ratingCount : 0;

  return {
    studied: Number(progress.studied || 0),
    unique: Object.keys(progress.cards || {}).length,
    ratingCount,
    ratingTotal,
    avg,
    mastery: Math.round((avg / 5) * 100)
  };
}

function timestampToText(value) {
  if (!value) return "—";
  try {
    const d = value.toDate ? value.toDate() : new Date(value);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function classCardCount() {
  return state.decks.reduce((sum, d) => sum + (d.cards?.length || 0), 0);
}

function currentClassStats() {
  let studied = 0;
  let unique = 0;
  let totalRatings = 0;
  let ratingCount = 0;

  for (const deck of state.decks) {
    const p = state.progressMap.get(deck.id);
    const s = progressStats(p);
    studied += s.studied;
    unique += s.unique;
    totalRatings += s.ratingTotal;
    ratingCount += s.ratingCount;
  }

  const avg = ratingCount ? totalRatings / ratingCount : 0;
  return {
    studied,
    unique,
    mastery: Math.round((avg / 5) * 100)
  };
}

function openModal(id) {
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function closeModals() {
  document.getElementById("modalBackdrop").classList.add("hidden");
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
}

async function signInGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(state.auth, provider);
  } catch (err) {
    handleFirebaseError(err, "Google sign-in failed.");
  }
}

async function ensureUserProfile() {
  await setDoc(doc(state.db, "users", state.user.uid), {
    displayName: isGuestStudent() ? guestStudentName() : (state.user.displayName || ""),
    email: state.user.email || "",
    photoURL: state.user.photoURL || "",
    guest: isGuestStudent(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function renderUser() {
  document.getElementById("sidebarName").textContent = isGuestStudent()
    ? "Guest Student"
    : (state.user.displayName?.split(" ")[0] || state.user.email || "User");

  const photo = document.getElementById("sidebarPhoto");
  if (state.user.photoURL) {
    photo.src = state.user.photoURL;
    photo.classList.remove("hidden");
  } else {
    photo.removeAttribute("src");
  }
}

async function routeAfterAuth() {
  const inviteId = classParam();

  if (!state.user) {
    if (inviteId) {
      try {
        const snap = await getDoc(doc(state.db, "classes", inviteId));
        if (snap.exists() && snap.data().published === true) {
          document.getElementById("sharedClassSignInTitle").textContent =
            snap.data().name || "Opening shared class…";
          showTopView("sharedSignInView");
          await signInAnonymously(state.auth);
          return;
        }
      } catch (err) {
        console.error(err);
        showTopView("loginView");
        showMessage(
          "Guest study could not start. Make sure Anonymous sign-in is enabled in Firebase Authentication.",
          "error",
          0
        );
        return;
      }
    }

    showTopView("loginView");
    return;
  }

  // Anonymous accounts exist only to let students study from a shared link.
  // If a guest reaches the regular Flashcards home page, return to teacher sign-in.
  if (isGuestStudent() && !inviteId) {
    await signOut(state.auth);
    return;
  }

  await ensureUserProfile();
  renderUser();
  applyGuestStudyUi();
  showTopView("appView");

  if (inviteId) {
    await acceptSharedClass(inviteId);
    return;
  }

  await loadLibrary();
  showPanel("libraryView");
}

async function loadLibrary() {
  await Promise.all([
    loadOwnedClasses(),
    loadSharedClasses(),
    loadSidebarStats(),
    loadSidebarClassOrder()
  ]);
  await normalizeSidebarClassOrder();
  renderSidebar();
  renderLibrary();
}

async function loadSidebarClassOrder() {
  try {
    const snap = await getDoc(doc(state.db, "users", state.user.uid));
    const saved = snap.exists() ? snap.data().sidebarClassOrder : [];
    state.sidebarClassOrder = Array.isArray(saved)
      ? saved.filter(id => typeof id === "string" && id)
      : [];
  } catch (err) {
    console.warn("Could not load sidebar class order.", err);
    state.sidebarClassOrder = [];
  }
}

function sidebarClassesInSavedOrder() {
  const classes = [...state.ownedClasses, ...state.sharedClasses];
  const byId = new Map(classes.map(c => [c.id, c]));
  const ordered = [];

  for (const id of state.sidebarClassOrder) {
    const c = byId.get(id);
    if (!c) continue;
    ordered.push(c);
    byId.delete(id);
  }

  const remaining = [...byId.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  return [...ordered, ...remaining];
}

async function normalizeSidebarClassOrder() {
  const normalized = sidebarClassesInSavedOrder().map(c => c.id);
  const changed =
    normalized.length !== state.sidebarClassOrder.length ||
    normalized.some((id, index) => id !== state.sidebarClassOrder[index]);

  state.sidebarClassOrder = normalized;
  if (!changed || !state.user) return;

  try {
    await setDoc(doc(state.db, "users", state.user.uid), {
      sidebarClassOrder: normalized,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not normalize sidebar class order.", err);
  }
}

async function saveSidebarClassOrder(ids) {
  state.sidebarClassOrder = [...ids];
  renderSidebar();

  try {
    await setDoc(doc(state.db, "users", state.user.uid), {
      sidebarClassOrder: ids,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error(err);
    showMessage("Could not save the class order.", "error");
    await loadSidebarClassOrder();
    renderSidebar();
  }
}

async function reorderSidebarClass(draggedId, targetId, placeAfter = false) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const ids = sidebarClassesInSavedOrder().map(c => c.id);
  const from = ids.indexOf(draggedId);
  if (from < 0) return;

  ids.splice(from, 1);
  let targetIndex = ids.indexOf(targetId);
  if (targetIndex < 0) return;
  if (placeAfter) targetIndex += 1;
  ids.splice(targetIndex, 0, draggedId);

  await saveSidebarClassOrder(ids);
}

function clearSidebarDragMarkers() {
  document.querySelectorAll(".sidebar-class-row").forEach(row => {
    row.classList.remove("dragging", "drag-over-before", "drag-over-after");
  });
}

function sidebarClassById(classId) {
  return [...state.ownedClasses, ...state.sharedClasses, ...state.archivedClasses]
    .find(c => c.id === classId) || null;
}

function closeSidebarClassMenu() {
  const menu = document.getElementById("sidebarClassMenu");
  if (menu) menu.hidden = true;
  state.sidebarMenuClassId = null;
}

function openSidebarClassMenu(button, classId) {
  const menu = document.getElementById("sidebarClassMenu");
  const c = sidebarClassById(classId);
  if (!menu || !c) return;

  state.sidebarMenuClassId = classId;
  const owned = c.ownerId === state.user?.uid;

  menu.querySelectorAll("[data-owner-only]").forEach(el => {
    el.hidden = !owned;
  });

  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";

  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const left = Math.max(8, Math.min(
    window.innerWidth - menuRect.width - 8,
    rect.right - menuRect.width
  ));
  const topBelow = rect.bottom + gap;
  const top = topBelow + menuRect.height <= window.innerHeight - 8
    ? topBelow
    : Math.max(8, rect.top - menuRect.height - gap);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function sidebarShareClass() {
  return sidebarClassById(state.sidebarShareClassId);
}

function syncSidebarShareModal() {
  const c = sidebarShareClass();
  if (!c) return;

  const input = document.getElementById("sidebarShareLinkNameInput");
  const className = document.getElementById("sidebarShareClassName");
  const urlPreview = document.getElementById("sidebarShareUrlPreview");
  const status = document.getElementById("sidebarShareStatus");
  const saveBtn = document.getElementById("sidebarShareSaveNameBtn");
  const copyBtn = document.getElementById("sidebarShareCopyLinkBtn");

  const saved = savedLinkPreviewTitle(c);
  const displayName = cleanShareTitle(input?.value || "") || saved || cleanShareTitle(c.name);

  if (className) className.textContent = c.name || "Class";
  if (urlPreview) urlPreview.value = buildClassShareLink(c.id, displayName);
  if (saveBtn) saveBtn.hidden = c.ownerId !== state.user?.uid;

  const ownerPrivate = c.ownerId === state.user?.uid && !c.published;
  if (copyBtn) copyBtn.disabled = ownerPrivate;

  if (status) {
    status.textContent = ownerPrivate
      ? "Class sharing is off. Open the class settings and enable sharing before copying a student link."
      : c.ownerId === state.user?.uid
        ? (saved
            ? "This class has a saved custom link display name. You can change it or use the class name."
            : "The copied link currently uses the class name. Type a different display name if you want.")
        : "You can customize the display name for the link you copy. This does not rename the class.";
  }
}

function openSidebarShareModal(classId) {
  const c = sidebarClassById(classId);
  if (!c) return;

  state.sidebarShareClassId = classId;
  const input = document.getElementById("sidebarShareLinkNameInput");
  if (input) input.value = savedLinkPreviewTitle(c) || cleanShareTitle(c.name);
  syncSidebarShareModal();
  openModal("sidebarShareModal");
  setTimeout(() => input?.focus(), 0);
}

async function saveSidebarShareLinkName() {
  const c = sidebarShareClass();
  if (!c || c.ownerId !== state.user?.uid) return;

  const input = document.getElementById("sidebarShareLinkNameInput");
  const title = cleanShareTitle(input?.value || "");
  if (!title) {
    showMessage("Enter a link display name.", "error");
    input?.focus();
    return;
  }

  try {
    await updateDoc(doc(state.db, "classes", c.id), {
      linkPreviewTitle: title,
      updatedAt: serverTimestamp()
    });
    c.linkPreviewTitle = title;
    if (state.selectedClass?.id === c.id) {
      state.selectedClass = { ...state.selectedClass, linkPreviewTitle: title };
      syncLinkPreviewTitleUi();
    }
    syncSidebarShareModal();
    showMessage("Link display name saved.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not save the link display name.");
  }
}

function useClassNameInSidebarShare() {
  const c = sidebarShareClass();
  if (!c) return;
  const input = document.getElementById("sidebarShareLinkNameInput");
  if (input) input.value = cleanShareTitle(c.name);
  syncSidebarShareModal();
}

async function copySidebarShareLink() {
  const c = sidebarShareClass();
  if (!c) return;

  const input = document.getElementById("sidebarShareLinkNameInput");
  const displayName = cleanShareTitle(input?.value || "") || cleanShareTitle(c.name);
  const link = buildClassShareLink(c.id, displayName);

  try {
    await navigator.clipboard.writeText(link);
    showMessage(`Link copied as “${displayName}”.`, "success");
    const preview = document.getElementById("sidebarShareUrlPreview");
    if (preview) preview.value = link;
  } catch (err) {
    console.error(err);
    showMessage("Could not copy the class link.", "error");
  }
}

async function duplicateClassById(classId) {
  const source = sidebarClassById(classId);
  if (!source || source.ownerId !== state.user?.uid) return;

  closeSidebarClassMenu();

  try {
    const sourceDeckSnap = await getDocs(collection(state.db, "classes", classId, "decks"));
    const copyName = `${String(source.name || "Class").trim()} Copy`;

    const newClassRef = await addDoc(collection(state.db, "classes"), {
      name: copyName,
      intro: source.intro || "",
      ownerId: state.user.uid,
      ownerName: state.user.displayName || state.user.email || "Owner",
      published: false,
      archived: false,
      linkPreviewTitle: "",
      classroomShareTitle: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    for (const deckDoc of sourceDeckSnap.docs) {
      const data = deckDoc.data();
      await addDoc(collection(state.db, "classes", newClassRef.id, "decks"), {
        name: data.name || "Deck",
        cards: Array.isArray(data.cards) ? data.cards : [],
        published: data.published !== false,
        archived: data.archived === true,
        archivedPublished: data.archivedPublished ?? null,
        order: Number(data.order ?? 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    await loadLibrary();
    await openClass(newClassRef.id);
    showMessage(`Duplicated as “${copyName}”. Sharing is off until you enable it.`, "success");
  } catch (err) {
    handleFirebaseError(err, "Could not duplicate the class.");
  }
}

async function deleteOwnedClassPermanently(classId) {
  const c = sidebarClassById(classId);
  if (!c || c.ownerId !== state.user?.uid) return;

  closeSidebarClassMenu();

  const className = String(c.name || "Untitled Class");
  const typedName = window.prompt(
    `Permanently delete "${className}" and every deck and card inside it? This cannot be undone.\n\nType the class name exactly to confirm:`
  );

  if (typedName === null) return;
  if (typedName.trim() !== className.trim()) {
    showMessage("Class name did not match. Nothing was deleted.", "error");
    return;
  }

  try {
    const deckSnap = await getDocs(collection(state.db, "classes", classId, "decks"));
    for (const deckSnapDoc of deckSnap.docs) {
      await deleteDoc(deckSnapDoc.ref);
    }
    await deleteDoc(doc(state.db, "classes", classId));

    const wasOpen = state.selectedClass?.id === classId;
    if (wasOpen) {
      state.selectedClass = null;
      state.decks = [];
    }

    await loadLibrary();
    if (wasOpen) showPanel("libraryView");
    showMessage(`“${className}” was permanently deleted.`, "success");
  } catch (err) {
    handleFirebaseError(err, "Could not permanently delete the class.");
  }
}

async function loadOwnedClasses() {
  const q = query(
    collection(state.db, "classes"),
    where("ownerId", "==", state.user.uid)
  );

  const snap = await getDocs(q);
  const allOwned = snap.docs
    .map(d => ({ id: d.id, ...d.data(), libraryType: "owned" }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  state.ownedClasses = allOwned.filter(c => c.archived !== true);
  state.archivedClasses = allOwned.filter(c => c.archived === true);
}

async function loadSharedClasses() {
  const refs = await getDocs(collection(state.db, "users", state.user.uid, "library"));
  const classes = [];

  for (const refSnap of refs.docs) {
    const data = refSnap.data();

    try {
      const cSnap = await getDoc(doc(state.db, "classes", data.classId || refSnap.id));

      if (cSnap.exists()) {
        const c = { id: cSnap.id, ...cSnap.data(), libraryType: "shared" };

        if (c.ownerId !== state.user.uid && c.archived !== true) {
          classes.push(c);
        }
      }
    } catch (_) {}
  }

  state.sharedClasses = classes.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function loadSidebarStats() {
  try {
    const q = query(
      collection(state.db, "progress"),
      where("studentId", "==", state.user.uid)
    );

    const snap = await getDocs(q);
    const rows = snap.docs.map(d => d.data());

    let studied = 0;
    let ratingTotal = 0;
    let ratingCount = 0;

    for (const p of rows) {
      studied += Number(p.studied || 0);
      ratingTotal += Number(p.ratingTotal || 0);
      ratingCount += Number(p.ratingCount || 0);
    }

    const mastery = ratingCount ? Math.round(((ratingTotal / ratingCount) / 5) * 100) : 0;

    document.getElementById("sidebarClassCount").textContent =
      state.ownedClasses.length + state.sharedClasses.length;
    document.getElementById("sidebarStudied").textContent = studied;
    document.getElementById("sidebarMastery").textContent = `${mastery}%`;
  } catch {
    document.getElementById("sidebarClassCount").textContent =
      state.ownedClasses.length + state.sharedClasses.length;
  }
}

function renderSidebar() {
  const classes = sidebarClassesInSavedOrder();
  const host = document.getElementById("classSidebarList");

  if (!classes.length) {
    host.innerHTML = `<div style="padding:20px 24px;color:#9fb3c8;font-size:.8rem;">No classes yet.</div>`;
    return;
  }

  host.innerHTML = classes.map(c => {
    const active = state.selectedClass?.id === c.id;
    const owned = c.libraryType === "owned";

    return `
      <div class="sidebar-class-row ${active ? "active" : ""}" data-sidebar-drop-row="${c.id}">
        <button
          class="sidebar-class-drag-handle"
          data-sidebar-drag-handle="${c.id}"
          draggable="true"
          type="button"
          title="Drag to rearrange ${escapeHtml(c.name)}"
          aria-label="Drag to rearrange ${escapeHtml(c.name)}"
        >⠿</button>

        <button
          class="sidebar-class-item ${active ? "active" : ""}"
          data-sidebar-class="${c.id}"
          type="button"
        >
          <span class="sidebar-stack-icon"><span></span></span>
          <span class="sidebar-class-copy">
            <strong>${escapeHtml(c.name)}</strong>
            <small>${owned ? "Owner" : "Study access"}</small>
          </span>
        </button>

        <button
          class="sidebar-class-menu-btn"
          data-sidebar-menu-button="${c.id}"
          type="button"
          title="Class options"
          aria-label="Options for ${escapeHtml(c.name)}"
          aria-haspopup="menu"
        >⋯</button>
      </div>
    `;
  }).join("");
}

function renderLibrary() {
  document.getElementById("archiveClassCountBadge").textContent = state.archivedClasses.length;
  document.getElementById("ownedClassCount").textContent = state.ownedClasses.length;
  document.getElementById("sharedClassCount").textContent = state.sharedClasses.length;

  const owned = document.getElementById("ownedClassCards");
  const shared = document.getElementById("sharedClassCards");

  owned.innerHTML = state.ownedClasses.length
    ? state.ownedClasses.map(c => classCardMarkup(c, true)).join("")
    : `<div class="empty-state">Create your first class.</div>`;

  shared.innerHTML = state.sharedClasses.length
    ? state.sharedClasses.map(c => classCardMarkup(c, false)).join("")
    : `<div class="empty-state">Classes shared with you will appear here.</div>`;
}

function classCardMarkup(c, owned) {
  return `
    <article class="class-card" data-library-class="${c.id}">
      <span class="eyebrow">${owned ? "Owner" : "Study access"}</span>
      <h3>${escapeHtml(c.name)}</h3>
      <p>${escapeHtml(c.intro || (owned ? "Your class" : `by ${c.ownerName || "Owner"}`))}</p>
      <div class="class-card-bottom">
        <span>${owned ? (c.published ? "Sharing enabled" : "Private") : `by ${escapeHtml(c.ownerName || "Owner")}`}</span>
        <strong>Open →</strong>
      </div>
    </article>
  `;
}

async function createClass() {
  const name = document.getElementById("newClassName").value.trim();
  const intro = document.getElementById("newClassIntro").value.trim();
  const published = document.getElementById("newClassPublished").checked;

  if (!name) {
    showMessage("Enter a class name.", "error");
    return;
  }

  try {
    const ref = await addDoc(collection(state.db, "classes"), {
      name,
      intro,
      ownerId: state.user.uid,
      ownerName: state.user.displayName || state.user.email || "Owner",
      published,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    document.getElementById("newClassName").value = "";
    document.getElementById("newClassIntro").value = "";
    document.getElementById("newClassPublished").checked = true;
    closeModals();

    await loadLibrary();
    await openClass(ref.id);

    if (published) {
      await copyClassLink(ref.id);
      showMessage("Class created. Share link copied.", "success");
    } else {
      showMessage("Class created.", "success");
    }
  } catch (err) {
    handleFirebaseError(err, "Could not create the class.");
  }
}

async function acceptSharedClass(classId) {
  try {
    const snap = await getDoc(doc(state.db, "classes", classId));

    if (!snap.exists()) {
      clearClassParam();
      showMessage("This class no longer exists.", "error");
      await loadLibrary();
      showPanel("libraryView");
      return;
    }

    const c = { id: snap.id, ...snap.data() };

    if (c.ownerId !== state.user.uid) {
      if (!c.published) {
        clearClassParam();
        showMessage("This class link is no longer active.", "error");
        await loadLibrary();
        showPanel("libraryView");
        return;
      }

      await setDoc(doc(state.db, "users", state.user.uid, "library", c.id), {
        classId: c.id,
        className: c.name,
        ownerId: c.ownerId,
        access: "study",
        addedAt: serverTimestamp()
      }, { merge: true });

      showMessage(
        isGuestStudent()
          ? `Guest study opened for "${c.name}" — no Google sign-in required.`
          : `"${c.name}" was added to My Flashcards.`,
        "success"
      );
    }

    if (!isGuestStudent()) clearClassParam();
    await loadLibrary();
    await openClass(c.id);
  } catch (err) {
    handleFirebaseError(err, "Could not add this class.");
  }
}

async function openClass(classId) {
  try {
    const snap = await getDoc(doc(state.db, "classes", classId));

    if (!snap.exists()) {
      showMessage("Class not found.", "error");
      return;
    }

    state.selectedClass = { id: snap.id, ...snap.data() };
    state.selectedStudyDeckIds.clear();
    state.studySelectionDeckIds = [];

    await Promise.all([loadDecks(), loadCurrentUserProgress()]);
    renderSidebar();
    renderClass();
    showPanel("classView");
    setTab("decks");
  } catch (err) {
    handleFirebaseError(err, "Could not open this class.");
  }
}

async function loadDecks() {
  const decksRef = collection(state.db, "classes", state.selectedClass.id, "decks");

  // Owners see every deck, including hidden drafts.
  // Students query only decks that are explicitly visible.
  const source = isOwner()
    ? decksRef
    : query(decksRef, where("published", "==", true));

  const snap = await getDocs(source);

  state.decks = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(deck => deck.archived !== true)
    .sort((a, b) => {
      const ao = Number(a.order ?? 99999);
      const bo = Number(b.order ?? 99999);
      if (ao !== bo) return ao - bo;
      return String(a.name).localeCompare(String(b.name));
    });
}

async function loadCurrentUserProgress() {
  const q = query(
    collection(state.db, "progress"),
    where("studentId", "==", state.user.uid)
  );

  const snap = await getDocs(q);
  const map = new Map();

  for (const d of snap.docs) {
    const p = { id: d.id, ...d.data() };
    if (p.classId === state.selectedClass.id) {
      map.set(p.deckId, p);
    }
  }

  state.progressMap = map;
}

function renderClass() {
  const owner = isOwner();
  const stats = currentClassStats();
  const totalCards = classCardCount();

  document.getElementById("classTitle").textContent = state.selectedClass.name;
  document.getElementById("classOwnerName").textContent = state.selectedClass.ownerName || "Owner";
  document.getElementById("classCardsStudied").textContent = `${stats.unique} of ${totalCards}`;
  document.getElementById("classDeckCount").textContent = state.decks.length;
  document.getElementById("classMastery").textContent = `${stats.mastery}%`;
  document.getElementById("masteryRing").style.setProperty("--mastery", stats.mastery);

  document.getElementById("tabDeckCount").textContent = `(${state.decks.length})`;
  document.getElementById("introClassTitle").textContent = state.selectedClass.name;
  document.getElementById("introText").textContent =
    state.selectedClass.intro || "No introduction has been added yet.";

  document.getElementById("editClassBtn").classList.toggle("hidden", !owner);
  document.getElementById("shareClassBtn").classList.toggle("hidden", !owner);
  document.getElementById("linkPreviewAction").classList.toggle("hidden", !owner);
  document.getElementById("classroomShareAction").classList.toggle("hidden", !owner || state.selectedClass.published === false);
  const shareTools = document.getElementById("classShareTools");
  if (shareTools) {
    shareTools.classList.toggle("hidden", !owner);
    if (!owner) shareTools.removeAttribute("open");
  }
  document.getElementById("ownerDeckTools").classList.toggle("hidden", !owner);
  document.getElementById("editIntroBtn").classList.toggle("hidden", !owner);
  document.getElementById("refreshLearnersBtn").classList.toggle("hidden", !owner);
  document.getElementById("removeSharedClassBtn").classList.toggle("hidden", owner || isGuestStudent());

  document.getElementById("shareClassBtn").disabled = owner && !state.selectedClass.published;
  document.getElementById("studyClassBtn").disabled = state.decks.length === 0;
  document.getElementById("quizClassBtn").disabled = state.decks.length === 0;

  applyClassDocumentTitle(state.selectedClass.name);
  syncLinkPreviewTitleUi();
  syncClassroomShareTitleUi();
  renderGoogleClassroomShare();
  renderDeckRows();

  // Shared users see only their own learner count conceptually; owner count is loaded on Learners tab.
  document.getElementById("tabLearnerCount").textContent = owner ? "(…)" : "";
}

function renderDeckRows() {
  const host = document.getElementById("deckRows");
  const owner = isOwner();

  // Keep only selections that still exist and contain cards.
  const studyableIds = new Set(
    state.decks.filter(deck => (deck.cards?.length || 0) > 0).map(deck => deck.id)
  );
  state.selectedStudyDeckIds = new Set(
    [...state.selectedStudyDeckIds].filter(id => studyableIds.has(id))
  );

  if (!state.decks.length) {
    host.innerHTML = `
      <div class="empty-state">
        ${owner ? "No decks yet. Create the first deck for this class." : "The owner has not added any decks yet."}
      </div>`;
    updateDeckStudySelectionUi();
    return;
  }

  host.innerHTML = state.decks.map(deck => {
    const s = progressStats(state.progressMap.get(deck.id));
    const total = deck.cards?.length || 0;
    const uniquePct = total ? Math.min(100, Math.round((s.unique / total) * 100)) : 0;

    return `
      <article class="deck-row">
        <div class="deck-percent">
          <span class="check-circle">✓</span>
          <strong>${s.mastery}%</strong>
        </div>

        <div class="deck-main">
          <div class="deck-title-row">
            <label class="deck-study-select" title="Include this deck in a combined study session">
              <input
                type="checkbox"
                data-select-study-deck="${deck.id}"
                ${state.selectedStudyDeckIds.has(deck.id) ? "checked" : ""}
                ${total ? "" : "disabled"}
              />
              <span aria-hidden="true"></span>
            </label>
            <h3>
              ${escapeHtml(deck.name)}
              ${owner ? `
              <span class="deck-status-badge ${deck.published === false ? "hidden" : "visible"}">
                ${deck.published === false ? "Hidden" : "Visible"}
              </span>
            ` : ""}
            </h3>
          </div>
          <div class="deck-progress-copy">
            <span>${s.unique} of ${total} unique cards studied</span>
          </div>
          <div class="deck-progress-track">
            <span style="width:${uniquePct}%"></span>
          </div>
        </div>

        <div class="deck-actions-row">
          ${owner ? `
            <div class="deck-owner-tools">
              <button
                class="deck-action-btn visibility-toggle"
                data-toggle-deck-visibility="${deck.id}"
                title="${deck.published === false ? "Make visible to students" : "Hide from students"}"
              >
                ${deck.published === false ? "Show" : "Hide"}
              </button>
              <button
                class="deck-action-btn copy-cards-btn"
                data-copy-cards-to-deck="${deck.id}"
                title="Copy cards from another deck"
              >
                Copy
              </button>
              <button class="deck-action-btn" data-edit-deck="${deck.id}" title="Edit deck">✎</button>
            </div>
          ` : ""}
          <div class="deck-primary-actions">
            <button class="deck-list-btn" data-view-deck-list="${deck.id}" title="View all cards">☷ List</button>
            <button class="deck-quiz" data-quiz-deck="${deck.id}" title="Quiz">Quiz ?</button>
            <button class="deck-play" data-study-deck="${deck.id}" title="Study">▶</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  updateDeckStudySelectionUi();
}

function openDeckList(deckId) {
  const deck = state.decks.find(item => item.id === deckId);
  if (!deck) return;

  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const title = document.getElementById("deckListTitle");
  const count = document.getElementById("deckListCount");
  const host = document.getElementById("deckListRows");

  if (!title || !count || !host) return;

  title.textContent = deck.name || "Deck";
  count.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  host.innerHTML = cards.length
    ? cards.map((card, index) => `
        <div class="deck-list-row">
          <span class="deck-list-number">${index + 1}</span>
          <div class="deck-list-side">
            <small>Front</small>
            <strong>${escapeHtml(card.front ?? "")}</strong>
          </div>
          <span class="deck-list-arrow" aria-hidden="true">→</span>
          <div class="deck-list-side">
            <small>Back</small>
            <strong>${escapeHtml(card.back ?? "")}</strong>
          </div>
        </div>
      `).join("")
    : '<div class="deck-list-empty">This deck does not contain any cards yet.</div>';

  openModal("deckListModal");
}

function studyableDecks() {
  return state.decks.filter(deck => (deck.cards?.length || 0) > 0);
}

function selectedStudyDecks() {
  const selected = state.selectedStudyDeckIds;
  return state.decks.filter(deck => selected.has(deck.id) && (deck.cards?.length || 0) > 0);
}

function updateDeckStudySelectionUi() {
  const selector = document.getElementById("deckStudySelector");
  const selectAll = document.getElementById("selectAllStudyDecks");
  const clearBtn = document.getElementById("clearDeckSelectionBtn");
  const studyBtn = document.getElementById("studySelectedDecksBtn");
  const countEl = document.getElementById("selectedDeckCount");

  if (!selector || !selectAll || !clearBtn || !studyBtn || !countEl) return;

  const available = studyableDecks();
  const selected = selectedStudyDecks();
  const selectedCards = selected.reduce((sum, deck) => sum + (deck.cards?.length || 0), 0);

  selector.classList.toggle("hidden", state.decks.length < 2);

  selectAll.checked = available.length > 0 && selected.length === available.length;
  selectAll.indeterminate = selected.length > 0 && selected.length < available.length;
  selectAll.disabled = available.length === 0;
  clearBtn.disabled = selected.length === 0;
  studyBtn.disabled = selected.length === 0;

  countEl.textContent = selected.length
    ? `${selected.length} selected · ${selectedCards} card${selectedCards === 1 ? "" : "s"}`
    : "Choose two or more decks to study together";

  studyBtn.textContent = selected.length
    ? `Study Selected (${selected.length})`
    : "Study Selected";
}

function setTab(name) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });

  document.getElementById("introTab").classList.toggle("hidden", name !== "intro");
  document.getElementById("decksTab").classList.toggle("hidden", name !== "decks");
  document.getElementById("learnersTab").classList.toggle("hidden", name !== "learners");

  if (name === "learners") {
    loadLearners();
  }
}


async function loadArchivedDecks() {
  const classes = [...state.ownedClasses, ...state.archivedClasses];
  const archived = [];

  for (const c of classes) {
    try {
      const snap = await getDocs(
        collection(state.db, "classes", c.id, "decks")
      );

      for (const deckSnap of snap.docs) {
        const deck = { id: deckSnap.id, ...deckSnap.data() };

        if (deck.archived === true) {
          archived.push({
            ...deck,
            classId: c.id,
            className: c.name,
            classArchived: c.archived === true
          });
        }
      }
    } catch (err) {
      console.error("Could not load archived decks for", c.id, err);
    }
  }

  state.archivedDecks = archived.sort((a, b) => {
    const classCompare = String(a.className || "").localeCompare(
      String(b.className || "")
    );
    if (classCompare) return classCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function renderArchiveManager() {
  const classHost = document.getElementById("archivedClassesList");
  const deckHost = document.getElementById("archivedDecksList");

  document.getElementById("archivedClassesCount").textContent =
    state.archivedClasses.length;
  document.getElementById("archivedDecksCount").textContent =
    state.archivedDecks.length;
  document.getElementById("archiveClassCountBadge").textContent =
    state.archivedClasses.length;

  classHost.innerHTML = state.archivedClasses.length
    ? state.archivedClasses.map(c => `
        <article class="archive-item">
          <div class="archive-item-icon">C</div>
          <div class="archive-item-copy">
            <strong>${escapeHtml(c.name)}</strong>
            <span>
              Class · ${c.archivedPublished ? "Sharing was enabled" : "Was private"}
            </span>
          </div>
          <div class="archive-item-actions">
            <button
              class="secondary-btn compact-btn"
              data-restore-class="${c.id}"
            >
              Restore
            </button>
            <button
              class="danger-btn compact-btn"
              data-delete-archived-class="${c.id}"
            >
              Delete Permanently
            </button>
          </div>
        </article>
      `).join("")
    : `<div class="archive-empty">No archived classes.</div>`;

  deckHost.innerHTML = state.archivedDecks.length
    ? state.archivedDecks.map(deck => `
        <article class="archive-item">
          <div class="archive-item-icon">D</div>
          <div class="archive-item-copy">
            <strong>${escapeHtml(deck.name)}</strong>
            <span>
              ${escapeHtml(deck.className)}
              ${deck.classArchived ? " · class archived" : ""}
              · ${deck.cards?.length || 0} cards
            </span>
          </div>
          <button
            class="secondary-btn compact-btn"
            data-restore-deck="${deck.classId}:${deck.id}"
          >
            Restore
          </button>
        </article>
      `).join("")
    : `<div class="archive-empty">No archived decks.</div>`;
}

async function openArchiveManager() {
  openModal("archiveModal");
  document.getElementById("archivedClassesList").innerHTML =
    `<div class="archive-empty">Loading…</div>`;
  document.getElementById("archivedDecksList").innerHTML =
    `<div class="archive-empty">Loading…</div>`;

  await loadOwnedClasses();
  await loadArchivedDecks();
  renderArchiveManager();
}

async function archiveCurrentClass() {
  if (!isOwner() || !state.selectedClass) return;

  const classToArchive = state.selectedClass;

  if (!confirm(
    `Archive "${classToArchive.name}"? It will disappear from your normal class list and be hidden from students.`
  )) {
    return;
  }

  try {
    await updateDoc(
      doc(state.db, "classes", classToArchive.id),
      {
        archived: true,
        archivedPublished: Boolean(classToArchive.published),
        published: false,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    closeModals();
    state.selectedClass = null;
    state.decks = [];
    await loadLibrary();
    showPanel("libraryView");
    showMessage(
      `"${classToArchive.name}" was archived. Its cards are still available for copying.`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not archive the class.");
  }
}

async function archiveClassById(classId) {
  const classToArchive =
    state.ownedClasses.find(c => c.id === classId) ||
    (state.selectedClass?.id === classId ? state.selectedClass : null);

  if (!classToArchive || classToArchive.ownerId !== state.user.uid) return;

  if (!confirm(
    `Archive "${classToArchive.name}"? It will disappear from your normal class list and be hidden from students.`
  )) {
    return;
  }

  try {
    await updateDoc(
      doc(state.db, "classes", classToArchive.id),
      {
        archived: true,
        archivedPublished: Boolean(classToArchive.published),
        published: false,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    const wasOpen = state.selectedClass?.id === classToArchive.id;

    if (wasOpen) {
      state.selectedClass = null;
      state.decks = [];
    }

    await loadLibrary();

    if (wasOpen) {
      showPanel("libraryView");
    }

    showMessage(
      `"${classToArchive.name}" was archived. Its cards are still available for copying.`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not archive the class.");
  }
}


async function restoreArchivedClass(classId) {
  const archivedClass = state.archivedClasses.find(c => c.id === classId);
  if (!archivedClass) return;

  try {
    await updateDoc(
      doc(state.db, "classes", classId),
      {
        archived: false,
        published: Boolean(archivedClass.archivedPublished),
        archivedPublished: null,
        restoredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    await loadLibrary();
    await loadArchivedDecks();
    renderArchiveManager();
    showMessage(`"${archivedClass.name}" was restored.`, "success");
  } catch (err) {
    handleFirebaseError(err, "Could not restore the class.");
  }
}

async function deleteArchivedClassPermanently(classId) {
  const archivedClass = state.archivedClasses.find(c => c.id === classId);
  if (!archivedClass || archivedClass.ownerId !== state.user?.uid) return;

  const className = String(archivedClass.name || "Untitled Class");
  const typedName = window.prompt(
    `Permanently delete "${className}" and every deck and card inside it? This cannot be undone.\n\nType the class name exactly to confirm:`
  );

  if (typedName === null) return;
  if (typedName.trim() !== className.trim()) {
    showMessage("Class name did not match. Nothing was deleted.", "error");
    return;
  }

  try {
    const deckSnap = await getDocs(collection(state.db, "classes", classId, "decks"));
    for (const deckSnapDoc of deckSnap.docs) {
      await deleteDoc(deckSnapDoc.ref);
    }
    await deleteDoc(doc(state.db, "classes", classId));

    if (state.selectedClass?.id === classId) {
      state.selectedClass = null;
      state.decks = [];
    }

    await loadLibrary();
    await loadArchivedDecks();
    renderArchiveManager();
    showMessage(`"${className}" was permanently deleted.`, "success");
  } catch (err) {
    handleFirebaseError(err, "Could not permanently delete the class.");
  }
}

async function archiveCurrentDeck() {
  if (!isOwner() || !state.editingDeckId) return;

  const deck = state.decks.find(d => d.id === state.editingDeckId);
  if (!deck) return;

  if (!confirm(
    `Archive "${deck.name}"? It will disappear from this class and be hidden from students.`
  )) {
    return;
  }

  try {
    await updateDoc(
      doc(
        state.db,
        "classes",
        state.selectedClass.id,
        "decks",
        deck.id
      ),
      {
        archived: true,
        archivedPublished: deck.published !== false,
        published: false,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    closeModals();
    await openClass(state.selectedClass.id);
    showMessage(
      `"${deck.name}" was archived. Its cards are still available for copying.`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not archive the deck.");
  }
}

async function restoreArchivedDeck(classId, deckId) {
  const archivedDeck = state.archivedDecks.find(
    d => d.classId === classId && d.id === deckId
  );

  if (!archivedDeck) return;

  try {
    await updateDoc(
      doc(state.db, "classes", classId, "decks", deckId),
      {
        archived: false,
        published: Boolean(archivedDeck.archivedPublished),
        archivedPublished: null,
        restoredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    await loadArchivedDecks();
    renderArchiveManager();

    if (state.selectedClass?.id === classId) {
      await openClass(classId);
      openModal("archiveModal");
      renderArchiveManager();
    }

    showMessage(`"${archivedDeck.name}" was restored.`, "success");
  } catch (err) {
    handleFirebaseError(err, "Could not restore the deck.");
  }
}

function openEditClass() {
  if (!isOwner()) return;

  document.getElementById("editClassName").value = state.selectedClass.name;
  document.getElementById("editClassIntro").value = state.selectedClass.intro || "";
  document.getElementById("editClassPublished").checked = Boolean(state.selectedClass.published);
  openModal("editClassModal");
}

async function saveClassChanges() {
  if (!isOwner()) return;

  const name = document.getElementById("editClassName").value.trim();
  const intro = document.getElementById("editClassIntro").value.trim();
  const published = document.getElementById("editClassPublished").checked;

  if (!name) {
    showMessage("Enter a class name.", "error");
    return;
  }

  try {
    await updateDoc(doc(state.db, "classes", state.selectedClass.id), {
      name,
      intro,
      published,
      updatedAt: serverTimestamp()
    });

    state.selectedClass = { ...state.selectedClass, name, intro, published };
    closeModals();
    await loadLibrary();
    await openClass(state.selectedClass.id);
    showMessage("Class updated.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not update the class.");
  }
}

async function copyClassLink(classId = state.selectedClass?.id) {
  if (!classId) return;

  const c = state.ownedClasses.find(x => x.id === classId) || state.selectedClass;

  if (c && c.published === false) {
    showMessage("Turn class sharing on before copying the link.", "error");
    return;
  }

  const displayName = linkPreviewTitleFor(c);
  const link = buildClassShareLink(classId, displayName);

  try {
    await navigator.clipboard.writeText(link);
    showMessage(`Class link copied with name “${displayName}”.`, "success");
  } catch {
    window.prompt("Copy this class link:", link);
  }
}

async function removeSharedClass() {
  if (isOwner()) return;

  try {
    await deleteDoc(doc(state.db, "users", state.user.uid, "library", state.selectedClass.id));
    state.selectedClass = null;
    await loadLibrary();
    showPanel("libraryView");
    showMessage("Class removed from My Flashcards.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not remove the class.");
  }
}

function openNewDeck() {
  if (!isOwner()) return;
  document.getElementById("newDeckName").value = "";
  document.getElementById("newDeckCards").value = "";
  document.getElementById("newDeckPublished").checked = true;
  openModal("newDeckModal");
}

async function createDeck() {
  if (!isOwner()) return;

  const name = document.getElementById("newDeckName").value.trim();
  const cards = parsePairs(document.getElementById("newDeckCards").value);
  const published = document.getElementById("newDeckPublished").checked;

  if (!name) {
    showMessage("Enter a deck name.", "error");
    return;
  }

  if (!cards.length) {
    showMessage("Add at least one valid card.", "error");
    return;
  }

  try {
    await addDoc(collection(state.db, "classes", state.selectedClass.id, "decks"), {
      name,
      cards,
      published,
      archived: false,
      order: state.decks.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    closeModals();
    await openClass(state.selectedClass.id);
    showMessage(
      published
        ? "Deck created and visible to students."
        : "Deck created as hidden. Students will not see it yet.",
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not create the deck.");
  }
}


function availableCopySourceClasses() {
  const byId = new Map();

  for (const c of [
    ...state.ownedClasses,
    ...state.archivedClasses,
    ...state.sharedClasses
  ]) {
    if (!c?.id) continue;
    byId.set(c.id, c);
  }

  if (state.selectedClass?.id && !byId.has(state.selectedClass.id)) {
    byId.set(state.selectedClass.id, {
      ...state.selectedClass,
      libraryType: isOwner() ? "owned" : "shared"
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.id === state.selectedClass?.id) return -1;
    if (b.id === state.selectedClass?.id) return 1;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function copyCardKey(card) {
  return `${normalizeText(card?.front)}\u0000${normalizeText(card?.back)}`;
}

function updateCopySelectionCount() {
  const checked = document.querySelectorAll(
    '#copyCardsList input[data-copy-card-index]:checked'
  ).length;

  document.getElementById("copySelectionCount").textContent =
    `${checked} selected`;
  document.getElementById("copySelectedCardsBtn").disabled = checked === 0;
}

function renderCopySourceCards() {
  const host = document.getElementById("copyCardsList");
  const cards = state.copySourceCards || [];

  document.getElementById("copySourceCardCount").textContent =
    `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  if (!cards.length) {
    host.innerHTML = `
      <div class="copy-cards-empty">
        This source deck does not contain any cards.
      </div>
    `;
    updateCopySelectionCount();
    return;
  }

  host.innerHTML = cards.map((card, index) => `
    <label class="copy-card-row">
      <input
        type="checkbox"
        data-copy-card-index="${index}"
      />
      <span class="copy-card-number">${index + 1}</span>
      <span class="copy-card-content">
        <strong>${escapeHtml(card.front)}</strong>
        <span class="copy-card-arrow">→</span>
        <span>${escapeHtml(card.back)}</span>
      </span>
    </label>
  `).join("");

  updateCopySelectionCount();
}

async function loadCopySourceCards() {
  const deckId = document.getElementById("copySourceDeckSelect").value;
  const deck = state.copySourceDecks.find(d => d.id === deckId);

  state.copySourceCards = Array.isArray(deck?.cards) ? deck.cards : [];
  renderCopySourceCards();
}

async function loadCopySourceDecks(classId) {
  const deckSelect = document.getElementById("copySourceDeckSelect");
  const cardList = document.getElementById("copyCardsList");

  state.copySourceDecks = [];
  state.copySourceCards = [];

  deckSelect.innerHTML = `<option value="">Loading decks…</option>`;
  deckSelect.disabled = true;
  cardList.innerHTML = `<div class="copy-cards-empty">Loading decks…</div>`;
  document.getElementById("copySourceCardCount").textContent = "0 cards";
  updateCopySelectionCount();

  if (!classId) {
    deckSelect.innerHTML = `<option value="">Choose a class first</option>`;
    return;
  }

  try {
    const sourceClass = availableCopySourceClasses().find(c => c.id === classId);
    if (!sourceClass) throw new Error("Source class is not available.");

    const decksRef = collection(state.db, "classes", classId, "decks");
    const userOwnsSource = sourceClass.ownerId === state.user.uid;

    const sourceQuery = userOwnsSource
      ? decksRef
      : query(decksRef, where("published", "==", true));

    const snap = await getDocs(sourceQuery);

    let decks = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(deck => userOwnsSource || deck.archived !== true)
      .sort((a, b) => {
        const archivedCompare =
          Number(a.archived === true) - Number(b.archived === true);
        if (archivedCompare) return archivedCompare;

        const ao = Number(a.order ?? 99999);
        const bo = Number(b.order ?? 99999);
        if (ao !== bo) return ao - bo;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    // Do not allow copying a deck into itself.
    decks = decks.filter(deck => !(
      classId === state.selectedClass.id &&
      deck.id === state.copyCardsDestinationDeckId
    ));

    state.copySourceDecks = decks;

    if (!decks.length) {
      deckSelect.innerHTML = `<option value="">No available decks</option>`;
      cardList.innerHTML = `
        <div class="copy-cards-empty">
          There are no other decks available in this class.
        </div>
      `;
      deckSelect.disabled = true;
      return;
    }

    deckSelect.innerHTML = decks.map(deck => `
      <option value="${deck.id}">
        ${escapeHtml(deck.name)}
        ${deck.archived === true ? " — Archived" : ""}
        (${deck.cards?.length || 0})
      </option>
    `).join("");

    deckSelect.disabled = false;
    await loadCopySourceCards();
  } catch (err) {
    console.error(err);
    deckSelect.innerHTML = `<option value="">Could not load decks</option>`;
    cardList.innerHTML = `
      <div class="copy-cards-empty">
        Could not load decks from this class.
      </div>
    `;
    showMessage("Could not load source decks.", "error");
  }
}

async function openCopyCards(deckId) {
  if (!isOwner()) return;

  const destination = state.decks.find(d => d.id === deckId);
  if (!destination) return;

  state.copyCardsDestinationDeckId = deckId;
  state.copySourceDecks = [];
  state.copySourceCards = [];

  document.getElementById("copyCardsDestinationName").textContent =
    destination.name;
  document.getElementById("copySkipDuplicates").checked = true;
  document.getElementById("copySelectionCount").textContent = "0 selected";
  document.getElementById("copySelectedCardsBtn").disabled = true;

  const classes = availableCopySourceClasses();
  const classSelect = document.getElementById("copySourceClassSelect");

  classSelect.innerHTML = classes.map(c => {
    const label =
      c.ownerId === state.user.uid
        ? "My class"
        : "Shared with me";

    const archivedLabel = c.archived === true ? " · Archived" : "";

    return `
      <option value="${c.id}">
        ${escapeHtml(c.name)} — ${label}${archivedLabel}
      </option>
    `;
  }).join("");

  openModal("copyCardsModal");

  const preferredClass =
    classes.find(c => c.id === state.selectedClass.id)?.id ||
    classes[0]?.id ||
    "";

  classSelect.value = preferredClass;
  await loadCopySourceDecks(preferredClass);
}

async function copySelectedCards() {
  if (!isOwner() || !state.copyCardsDestinationDeckId) return;

  const destination = state.decks.find(
    d => d.id === state.copyCardsDestinationDeckId
  );

  if (!destination) {
    showMessage("Destination deck could not be found.", "error");
    return;
  }

  const selectedIndexes = [...document.querySelectorAll(
    '#copyCardsList input[data-copy-card-index]:checked'
  )]
    .map(input => Number(input.dataset.copyCardIndex))
    .filter(index => Number.isInteger(index));

  if (!selectedIndexes.length) {
    showMessage("Select at least one card to copy.", "error");
    return;
  }

  const selectedCards = selectedIndexes
    .map(index => state.copySourceCards[index])
    .filter(Boolean);

  const skipDuplicates =
    document.getElementById("copySkipDuplicates").checked;

  const existingCards = Array.isArray(destination.cards)
    ? destination.cards
    : [];

  const existingKeys = new Set(existingCards.map(copyCardKey));
  const cardsToAdd = [];
  let skipped = 0;

  for (const sourceCard of selectedCards) {
    const key = copyCardKey(sourceCard);

    if (skipDuplicates && existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    cardsToAdd.push({
      id: uid("card"),
      front: sourceCard.front,
      back: sourceCard.back
    });

    existingKeys.add(key);
  }

  if (!cardsToAdd.length) {
    showMessage(
      skipped
        ? "All selected cards are already in this deck."
        : "No cards were copied.",
      "error"
    );
    return;
  }

  const copyBtn = document.getElementById("copySelectedCardsBtn");
  copyBtn.disabled = true;
  copyBtn.textContent = "Copying…";

  try {
    await updateDoc(
      doc(
        state.db,
        "classes",
        state.selectedClass.id,
        "decks",
        destination.id
      ),
      {
        cards: [...existingCards, ...cardsToAdd],
        updatedAt: serverTimestamp()
      }
    );

    closeModals();
    await openClass(state.selectedClass.id);

    const skippedText = skipped
      ? ` ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.`
      : "";

    showMessage(
      `${cardsToAdd.length} card${cardsToAdd.length === 1 ? "" : "s"} copied to "${destination.name}".${skippedText}`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not copy the selected cards.");
  } finally {
    copyBtn.textContent = "Copy Selected Cards";
    copyBtn.disabled = false;
  }
}

function openEditDeck(deckId) {
  if (!isOwner()) return;

  const deck = state.decks.find(d => d.id === deckId);
  if (!deck) return;

  state.editingDeckId = deckId;
  document.getElementById("editDeckName").value = deck.name;
  document.getElementById("editDeckCards").value = cardsToText(deck.cards);
  document.getElementById("editDeckPublished").checked = deck.published !== false;
  openModal("editDeckModal");
}

async function saveDeckChanges() {
  if (!isOwner() || !state.editingDeckId) return;

  const name = document.getElementById("editDeckName").value.trim();
  const cards = parsePairs(document.getElementById("editDeckCards").value);
  const published = document.getElementById("editDeckPublished").checked;

  if (!name) {
    showMessage("Enter a deck name.", "error");
    return;
  }

  if (!cards.length) {
    showMessage("Add at least one valid card.", "error");
    return;
  }

  try {
    await updateDoc(
      doc(state.db, "classes", state.selectedClass.id, "decks", state.editingDeckId),
      {
        name,
        cards,
        published,
        updatedAt: serverTimestamp()
      }
    );

    closeModals();
    await openClass(state.selectedClass.id);
    showMessage("Deck updated for everyone following this class.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not update the deck.");
  }
}

async function toggleDeckVisibility(deckId) {
  if (!isOwner()) return;

  const deck = state.decks.find(d => d.id === deckId);
  if (!deck) return;

  const nextPublished = deck.published === false;

  try {
    await updateDoc(
      doc(state.db, "classes", state.selectedClass.id, "decks", deckId),
      {
        published: nextPublished,
        updatedAt: serverTimestamp()
      }
    );

    await openClass(state.selectedClass.id);

    showMessage(
      nextPublished
        ? `"${deck.name}" is now visible to students.`
        : `"${deck.name}" is hidden from students.`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(err, "Could not change deck visibility.");
  }
}

async function deleteCurrentDeck() {
  if (!isOwner() || !state.editingDeckId) return;

  if (!confirm("Delete this deck? It will disappear for everyone following the class.")) {
    return;
  }

  try {
    await deleteDoc(
      doc(state.db, "classes", state.selectedClass.id, "decks", state.editingDeckId)
    );

    closeModals();
    await openClass(state.selectedClass.id);
    showMessage("Deck deleted.", "success");
  } catch (err) {
    handleFirebaseError(err, "Could not delete the deck.");
  }
}

async function loadLearners() {
  const host = document.getElementById("learnersContent");

  if (!isOwner()) {
    state.learners = [];
    state.selectedLearnerIds.clear();
    const rows = [];

    for (const deck of state.decks) {
      const s = progressStats(state.progressMap.get(deck.id));
      const rawProgress = state.progressMap.get(deck.id);
      rows.push({
        deck: deck.name,
        studied: s.studied,
        unique: s.unique,
        total: deck.cards?.length || 0,
        mastery: s.mastery,
        quizAnswered: Number(rawProgress?.quizAnswered || 0),
        quizCorrect: Number(rawProgress?.quizCorrect || 0)
      });
    }

    document.getElementById("tabLearnerCount").textContent = "";

    host.innerHTML = rows.length
      ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Deck</th><th>Unique Studied</th><th>Total Reviews</th><th>Mastery</th><th>Quiz</th></tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${escapeHtml(r.deck)}</td>
                  <td>${r.unique} of ${r.total}</td>
                  <td>${r.studied}</td>
                  <td>${r.mastery}%</td>
                  <td>${r.quizAnswered ? `${Math.round((r.quizCorrect / r.quizAnswered) * 100)}% (${r.quizCorrect}/${r.quizAnswered})` : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`
      : `<div class="empty-state">No progress yet.</div>`;

    return;
  }

  host.innerHTML = `<div class="empty-state">Loading learners…</div>`;

  try {
    const q = query(
      collection(state.db, "progress"),
      where("classId", "==", state.selectedClass.id)
    );

    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.studentId !== state.user.uid);

    const byStudent = new Map();

    for (const p of docs) {
      const key = p.studentId;
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          studentId: key,
          name: p.studentName || "Student",
          email: p.studentEmail || "",
          studied: 0,
          ratingTotal: 0,
          ratingCount: 0,
          quizAnswered: 0,
          quizCorrect: 0,
          uniqueKeys: new Set(),
          updatedAt: p.updatedAt
        });
      }

      const row = byStudent.get(key);
      row.studied += Number(p.studied || 0);
      row.ratingTotal += Number(p.ratingTotal || 0);
      row.ratingCount += Number(p.ratingCount || 0);
      row.quizAnswered += Number(p.quizAnswered || 0);
      row.quizCorrect += Number(p.quizCorrect || 0);

      Object.keys(p.cards || {}).forEach(cardId => {
        row.uniqueKeys.add(`${p.deckId}:${cardId}`);
      });

      if (p.updatedAt) {
        row.updatedAt = p.updatedAt;
      }
    }

    const learners = [...byStudent.values()]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    state.learners = learners;
    document.getElementById("tabLearnerCount").textContent = `(${learners.length})`;

    state.selectedLearnerIds.clear();

    if (!learners.length) {
      host.innerHTML = `<div class="empty-state">No learners have studied this class yet.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="learner-bulk-toolbar">
        <label class="learner-select-all">
          <input id="selectAllLearnersCheckbox" type="checkbox" />
          <span>Select all</span>
        </label>
        <span id="selectedLearnersCount" class="learner-selected-count">0 selected</span>
        <div class="learner-bulk-actions">
          <button id="removeSelectedLearnersBtn" class="danger-btn compact-btn" type="button" disabled>
            Remove Selected
          </button>
          <button id="removeAllLearnersBtn" class="danger-outline-btn compact-btn" type="button">
            Remove All
          </button>
        </div>
      </div>
      <div class="table-wrap learner-table-wrap">
        <table class="data-table learners-table">
          <thead>
            <tr>
              <th class="learner-select-cell" aria-label="Select"></th>
              <th>Learner</th>
              <th>Email</th>
              <th>Unique Cards</th>
              <th>Total Reviews</th>
              <th>Mastery</th>
              <th>Quiz</th>
              <th>Last Studied</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${learners.map(l => {
              const avg = l.ratingCount ? l.ratingTotal / l.ratingCount : 0;
              const mastery = Math.round((avg / 5) * 100);

              return `
                <tr data-learner-row="${escapeHtml(l.studentId)}">
                  <td class="learner-select-cell">
                    <input
                      type="checkbox"
                      class="learner-select-checkbox"
                      data-select-learner="${escapeHtml(l.studentId)}"
                      aria-label="Select ${escapeHtml(l.name)}"
                    />
                  </td>
                  <td>${escapeHtml(l.name)}</td>
                  <td>${escapeHtml(l.email || "—")}</td>
                  <td>${l.uniqueKeys.size}</td>
                  <td>${l.studied}</td>
                  <td>${mastery}%</td>
                  <td>${l.quizAnswered ? `${Math.round((l.quizCorrect / l.quizAnswered) * 100)}% (${l.quizCorrect}/${l.quizAnswered})` : "—"}</td>
                  <td>${timestampToText(l.updatedAt)}</td>
                  <td class="learner-action-cell">
                    <button
                      type="button"
                      class="danger-btn compact-btn remove-learner-btn"
                      data-remove-learner="${escapeHtml(l.studentId)}"
                      aria-label="Remove ${escapeHtml(l.name)} from this class"
                    >Remove</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>`;

    updateLearnerBulkControls();
  } catch (err) {
    host.innerHTML = `<div class="empty-state">Learners could not be loaded.</div>`;
    handleFirebaseError(err, "Could not load learners.");
  }
}


function updateLearnerBulkControls() {
  if (!isOwner()) return;

  const validIds = new Set(state.learners.map(learner => learner.studentId));
  state.selectedLearnerIds = new Set(
    [...state.selectedLearnerIds].filter(studentId => validIds.has(studentId))
  );

  const selectedCount = state.selectedLearnerIds.size;
  const totalCount = state.learners.length;
  const selectAll = document.getElementById("selectAllLearnersCheckbox");
  const countLabel = document.getElementById("selectedLearnersCount");
  const removeSelectedBtn = document.getElementById("removeSelectedLearnersBtn");

  if (selectAll) {
    selectAll.checked = totalCount > 0 && selectedCount === totalCount;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  if (countLabel) {
    countLabel.textContent = `${selectedCount} selected`;
  }

  if (removeSelectedBtn) {
    removeSelectedBtn.disabled = selectedCount === 0;
    removeSelectedBtn.textContent = selectedCount
      ? `Remove Selected (${selectedCount})`
      : "Remove Selected";
  }

  document.querySelectorAll("[data-select-learner]").forEach(checkbox => {
    checkbox.checked = state.selectedLearnerIds.has(checkbox.dataset.selectLearner);
  });

  document.querySelectorAll("[data-learner-row]").forEach(row => {
    row.classList.toggle(
      "learner-row-selected",
      state.selectedLearnerIds.has(row.dataset.learnerRow)
    );
  });
}

function setAllLearnersSelected(selected) {
  if (!isOwner()) return;

  state.selectedLearnerIds = selected
    ? new Set(state.learners.map(learner => learner.studentId))
    : new Set();

  updateLearnerBulkControls();
}

function toggleLearnerSelection(studentId, selected) {
  if (!isOwner()) return;

  if (selected) {
    state.selectedLearnerIds.add(studentId);
  } else {
    state.selectedLearnerIds.delete(studentId);
  }

  updateLearnerBulkControls();
}

function openRemoveLearnersModal(studentIds) {
  if (!isOwner()) return;

  const wantedIds = new Set((studentIds || []).filter(Boolean));
  const learners = state.learners.filter(learner => wantedIds.has(learner.studentId));

  if (!learners.length) {
    showMessage("No learners were selected. Refresh the Learners tab and try again.", "error");
    return;
  }

  state.pendingLearnerRemoval = {
    learnerIds: learners.map(learner => learner.studentId),
    learners: learners.map(learner => ({
      studentId: learner.studentId,
      name: learner.name || "Student",
      email: learner.email || ""
    }))
  };

  const count = learners.length;
  const names = learners.slice(0, 5).map(learner => learner.name || "Student");
  const moreCount = Math.max(0, count - names.length);

  document.getElementById("removeLearnerModalTitle").textContent =
    count === 1 ? "Remove learner?" : `Remove ${count} learners?`;
  document.getElementById("removeLearnerName").textContent =
    count === 1 ? names[0] : `${count} learners selected`;
  document.getElementById("removeLearnerEmail").textContent =
    count === 1
      ? (learners[0].email || "No email available")
      : `${names.join(", ")}${moreCount ? ` +${moreCount} more` : ""}`;

  const confirmBtn = document.getElementById("confirmRemoveLearnerBtn");
  confirmBtn.textContent = count === 1 ? "Remove Learner" : `Remove ${count} Learners`;

  openModal("removeLearnerModal");
}

function openRemoveLearnerModal(studentId) {
  openRemoveLearnersModal([studentId]);
}

function openRemoveSelectedLearnersModal() {
  openRemoveLearnersModal([...state.selectedLearnerIds]);
}

function openRemoveAllLearnersModal() {
  openRemoveLearnersModal(state.learners.map(learner => learner.studentId));
}

async function commitDeleteRefsInChunks(refs, chunkSize = 450) {
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(state.db);
    refs.slice(i, i + chunkSize).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function confirmRemoveLearner() {
  if (!isOwner() || !state.pendingLearnerRemoval || !state.selectedClass) return;

  const pending = state.pendingLearnerRemoval;
  const learners = pending.learners || [];
  const learnerIds = new Set(pending.learnerIds || []);
  if (!learnerIds.size) return;

  const classId = state.selectedClass.id;
  const button = document.getElementById("confirmRemoveLearnerBtn");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = learnerIds.size === 1 ? "Removing…" : `Removing ${learnerIds.size}…`;

  try {
    const progressQuery = query(
      collection(state.db, "progress"),
      where("classId", "==", classId)
    );
    const progressSnap = await getDocs(progressQuery);

    const refsToDelete = [];

    learnerIds.forEach(studentId => {
      refsToDelete.push(doc(state.db, "users", studentId, "library", classId));
    });

    progressSnap.docs.forEach(progressDoc => {
      if (learnerIds.has(progressDoc.data().studentId)) {
        refsToDelete.push(progressDoc.ref);
      }
    });

    await commitDeleteRefsInChunks(refsToDelete);

    const removedNames = learners.map(learner => learner.name || "Student");
    const removedCount = learnerIds.size;

    state.pendingLearnerRemoval = null;
    state.selectedLearnerIds.clear();
    closeModals();
    await loadLearners();

    showMessage(
      removedCount === 1
        ? `“${removedNames[0] || "Learner"}” was removed from this class.`
        : `${removedCount} learners were removed from this class.`,
      "success"
    );
  } catch (err) {
    handleFirebaseError(
      err,
      "Could not remove the learners. Make sure the updated Flashcards Firestore rules are published."
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function chooseStudyOrder(scope, deckId = null, deckIds = null) {
  let targetName = state.selectedClass?.name || "Class";
  let selectedIds = Array.isArray(deckIds) ? deckIds : [];

  if (scope === "deck") {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck?.cards?.length) return;
    targetName = deck.name;
  } else if (scope === "selection") {
    const allowed = new Set(studyableDecks().map(deck => deck.id));
    selectedIds = selectedIds.filter(id => allowed.has(id));
    if (!selectedIds.length) return;
    targetName = `${selectedIds.length} selected deck${selectedIds.length === 1 ? "" : "s"}`;
  } else if (!state.decks.some(deck => deck.cards?.length)) {
    return;
  }

  state.pendingStudy = { scope, deckId, deckIds: selectedIds };
  document.getElementById("studyOrderTarget").textContent =
    scope === "deck"
      ? `Study deck: ${targetName}`
      : scope === "selection"
        ? `Study together: ${targetName}`
        : `Study class: ${targetName}`;

  document.querySelectorAll("[data-study-direction]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.studyDirection === state.studyDirection);
  });

  openModal("studyOrderModal");
}

function beginPendingStudy(order) {
  const pending = state.pendingStudy;
  if (!pending) return;

  state.studyOrder = order;
  const direction = state.studyDirection;
  closeModals();

  if (pending.scope === "deck") {
    startDeckStudy(pending.deckId, order, direction);
  } else if (pending.scope === "selection") {
    startSelectedDecksStudy(pending.deckIds, order, direction);
  } else {
    startClassStudy(order, direction);
  }

  state.pendingStudy = null;
}

function studyDirectionLabel(direction) {
  if (direction === "backFront") return "Back → Front";
  if (direction === "mixed") return "Mixed Direction";
  return "Front → Back";
}

function applyStudyDirection(cards, direction = state.studyDirection) {
  return cards.map(card => ({
    ...card,
    _studyDirection: direction === "mixed"
      ? (Math.random() < 0.5 ? "frontBack" : "backFront")
      : direction
  }));
}

function startDeckStudy(deckId, order = state.studyOrder, direction = state.studyDirection) {
  const deck = state.decks.find(d => d.id === deckId);
  if (!deck?.cards?.length) return;

  state.studyScope = "deck";
  state.selectedDeck = deck;
  state.studyMode = "standard";
  state.studyOrder = order;
  state.studyDirection = direction;

  const cards = applyStudyDirection(deck.cards.map(card => ({
    ...card,
    deckId: deck.id,
    deckName: deck.name
  })), direction);

  state.sessionCards = order === "random"
    ? shuffledCopy(cards)
    : cards;

  prepareSession(
    deck.name,
    `Deck Study · ${studyDirectionLabel(direction)} · ${order === "random" ? "Random" : "Progressive"}`
  );
}

function startSelectedDecksStudy(deckIds, order = state.studyOrder, direction = state.studyDirection) {
  const wanted = new Set(Array.isArray(deckIds) ? deckIds : []);
  const decks = state.decks.filter(
    deck => wanted.has(deck.id) && (deck.cards?.length || 0) > 0
  );

  if (!decks.length) return;

  const cards = [];
  for (const deck of decks) {
    for (const card of deck.cards || []) {
      cards.push({
        ...card,
        deckId: deck.id,
        deckName: deck.name
      });
    }
  }

  if (!cards.length) return;

  state.studyScope = "selection";
  state.selectedDeck = null;
  state.studySelectionDeckIds = decks.map(deck => deck.id);
  state.studyMode = "standard";
  state.studyOrder = order;
  state.studyDirection = direction;

  const directedCards = applyStudyDirection(cards, direction);
  state.sessionCards = order === "random"
    ? shuffledCopy(directedCards)
    : directedCards;

  prepareSession(
    state.selectedClass.name,
    `${decks.length} Selected Deck${decks.length === 1 ? "" : "s"} · ${studyDirectionLabel(direction)} · ${order === "random" ? "Random" : "Progressive"}`
  );
}

function startClassStudy(order = state.studyOrder, direction = state.studyDirection) {
  const cards = [];

  for (const deck of state.decks) {
    for (const card of deck.cards || []) {
      cards.push({
        ...card,
        deckId: deck.id,
        deckName: deck.name
      });
    }
  }

  if (!cards.length) return;

  state.studyScope = "class";
  state.selectedDeck = null;
  state.studyMode = "standard";
  state.studyOrder = order;
  state.studyDirection = direction;

  const directedCards = applyStudyDirection(cards, direction);
  state.sessionCards = order === "random"
    ? shuffledCopy(directedCards)
    : directedCards;

  prepareSession(
    state.selectedClass.name,
    `Class Study · ${studyDirectionLabel(direction)} · ${order === "random" ? "Random" : "Progressive"}`
  );
}


function chooseQuizSetup(scope, deckId = null) {
  let targetName = state.selectedClass?.name || "Class";

  if (scope === "deck") {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck?.cards?.length) return;
    targetName = deck.name;
  } else if (!state.decks.some(deck => deck.cards?.length)) {
    return;
  }

  state.pendingQuiz = { scope, deckId };
  const availableQuestionCount = collectQuizCards(scope, deckId).length;
  const savedDefaults = readQuizDefaults();
  const useAllQuestions = !savedDefaults || savedDefaults.questionCountMode === "all";
  const savedQuestionCount = savedDefaults?.questionCount || availableQuestionCount;

  state.quizConfig = {
    questionStyle: savedDefaults?.questionStyle || "standard",
    template: savedDefaults?.template || "What is the answer for {term}?",
    direction: savedDefaults?.direction || "frontBack",
    answerMode: savedDefaults?.answerMode || "multiple",
    order: savedDefaults?.order || "progressive",
    inclusionMode: savedDefaults?.inclusionMode || "count",
    questionCount: useAllQuestions
      ? availableQuestionCount
      : Math.max(1, Math.min(availableQuestionCount, savedQuestionCount)),
    questionCountMode: useAllQuestions ? "all" : "fixed",
    manualCardKeys: [],
    points: savedDefaults?.points ?? 1
  };

  document.getElementById("quizSetupTarget").textContent =
    scope === "deck"
      ? `Quiz deck: ${targetName}`
      : `Quiz class: ${targetName}`;

  document.querySelectorAll("[data-quiz-setting]").forEach(group => {
    const setting = group.dataset.quizSetting;
    group.querySelectorAll(".quiz-setting-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === state.quizConfig[setting]);
    });
  });

  document.getElementById("quizTemplateInput").value = state.quizConfig.template;
  document.getElementById("quizTemplateField").classList.toggle(
    "hidden",
    state.quizConfig.questionStyle !== "custom"
  );

  const questionCountInput = document.getElementById("quizQuestionCountInput");
  questionCountInput.max = String(Math.max(1, availableQuestionCount));
  questionCountInput.value = String(Math.max(1, state.quizConfig.questionCount));
  document.getElementById("quizQuestionCountHelp").textContent =
    `${availableQuestionCount} card${availableQuestionCount === 1 ? "" : "s"} available. ` +
    `Progressive uses the first questions; Random chooses from across the set.`;

  syncQuizInclusionUi();

  document.getElementById("quizPointsInput").value = state.quizConfig.points;
  document.getElementById("exportGoogleFormsBtn").classList.toggle("hidden", !isOwner());
  updateQuizDefaultControls(Boolean(savedDefaults));
  resetGoogleFormsGeneratedScript();

  openModal("quizSetupModal");
}

function collectQuizCards(scope, deckId = null) {
  const cards = [];

  if (scope === "deck") {
    const deck = state.decks.find(d => d.id === deckId);
    if (!deck) return cards;

    for (const card of deck.cards || []) {
      cards.push({
        ...card,
        deckId: deck.id,
        deckName: deck.name
      });
    }

    return cards;
  }

  for (const deck of state.decks) {
    for (const card of deck.cards || []) {
      cards.push({
        ...card,
        deckId: deck.id,
        deckName: deck.name
      });
    }
  }

  return cards;
}

function quizCardKey(card) {
  return `${card.deckId}::${card.id}`;
}

function availableQuizCards() {
  if (!state.pendingQuiz) return [];
  return collectQuizCards(state.pendingQuiz.scope, state.pendingQuiz.deckId);
}

function normalizeManualQuizSelection() {
  const available = availableQuizCards();
  const validKeys = new Set(available.map(quizCardKey));
  const current = Array.isArray(state.quizConfig.manualCardKeys)
    ? state.quizConfig.manualCardKeys
    : [];

  state.quizConfig.manualCardKeys = current.filter(key => validKeys.has(key));
}

function ensureManualQuizSelection() {
  normalizeManualQuizSelection();
  if (state.quizConfig.manualCardKeys.length) return;

  // Start with everything selected the first time Manual Pick is opened.
  // This makes it quick to remove only a few cards, while Clear supports building from zero.
  state.quizConfig.manualCardKeys = availableQuizCards().map(quizCardKey);
}

function renderManualQuizPicker() {
  const list = document.getElementById("quizManualCardList");
  const countEl = document.getElementById("quizManualSelectionCount");
  if (!list || !countEl) return;

  normalizeManualQuizSelection();
  const selected = new Set(state.quizConfig.manualCardKeys || []);
  const cards = availableQuizCards();

  countEl.textContent = `${selected.size} of ${cards.length} selected`;

  if (!cards.length) {
    list.innerHTML = '<div class="quiz-manual-empty">No flashcards are available.</div>';
    return;
  }

  list.innerHTML = cards.map((card, index) => {
    const key = quizCardKey(card);
    const checked = selected.has(key) ? "checked" : "";
    return `
      <label class="quiz-manual-card-row">
        <input type="checkbox" data-quiz-manual-card="${escapeHtml(key)}" ${checked} />
        <span class="quiz-manual-card-number">${index + 1}</span>
        <span class="quiz-manual-card-copy">
          <strong>${escapeHtml(card.front)}</strong>
          <span>${escapeHtml(card.back)}</span>
          <small>${escapeHtml(card.deckName || "Deck")}</small>
        </span>
      </label>
    `;
  }).join("");
}

function syncQuizInclusionUi() {
  const manual = state.quizConfig.inclusionMode === "manual";
  document.getElementById("quizCountModePanel")?.classList.toggle("hidden", manual);
  document.getElementById("quizManualModePanel")?.classList.toggle("hidden", !manual);

  if (manual) {
    ensureManualQuizSelection();
    renderManualQuizPicker();
  }
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildMultipleChoiceOptions(card, direction, allCards) {
  const correct = direction === "frontBack" ? card.back : card.front;
  const pool = uniqueValues(
    allCards
      .filter(c => c.id !== card.id || c.deckId !== card.deckId)
      .map(c => direction === "frontBack" ? c.back : c.front)
      .filter(value => normalizeText(value) !== normalizeText(correct))
  );

  if (pool.length < 3) return null;

  const distractors = shuffledCopy(pool).slice(0, 3);
  return shuffledCopy([correct, ...distractors]);
}

function buildQuizQuestions(scope, deckId, config) {
  const allCards = collectQuizCards(scope, deckId);
  let cards;

  if (config.inclusionMode === "manual") {
    const selectedKeys = new Set(Array.isArray(config.manualCardKeys) ? config.manualCardKeys : []);
    cards = allCards.filter(card => selectedKeys.has(quizCardKey(card)));
    if (config.order === "random") cards = shuffledCopy(cards);
  } else {
    cards = config.order === "random"
      ? shuffledCopy(allCards)
      : [...allCards];

    const requestedCount = Number(config.questionCount);
    const questionCount = Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(allCards.length, Math.floor(requestedCount))
      : allCards.length;

    cards = cards.slice(0, questionCount);
  }

  return cards.map((card, index) => {
    const direction = config.direction === "mixed"
      ? (Math.random() < 0.5 ? "frontBack" : "backFront")
      : config.direction;

    const term = direction === "frontBack" ? card.front : card.back;
    const answer = direction === "frontBack" ? card.back : card.front;

    const prompt = config.questionStyle === "custom"
      ? String(config.template || "").replaceAll("{term}", term)
      : term;

    let requestedType = config.answerMode;
    if (requestedType === "mixed") {
      requestedType = index % 2 === 0 ? "multiple" : "typed";
    }

    let options = null;
    let type = requestedType;

    if (requestedType === "multiple") {
      options = buildMultipleChoiceOptions(card, direction, allCards);
      if (!options) type = "typed";
    }

    return {
      id: `${card.deckId}:${card.id}:${index}`,
      cardId: card.id,
      deckId: card.deckId,
      deckName: card.deckName,
      prompt,
      answer,
      direction,
      type,
      options
    };
  });
}

function syncQuizSetupInputs() {
  state.quizConfig.template = document.getElementById("quizTemplateInput").value.trim();

  const availableCount = state.pendingQuiz
    ? collectQuizCards(state.pendingQuiz.scope, state.pendingQuiz.deckId).length
    : 0;

  if (state.quizConfig.inclusionMode === "manual") {
    normalizeManualQuizSelection();
  } else {
    const rawQuestionCount = Number(document.getElementById("quizQuestionCountInput").value);
    state.quizConfig.questionCount = availableCount
      ? Math.max(1, Math.min(availableCount, Math.floor(rawQuestionCount || availableCount)))
      : 0;
    document.getElementById("quizQuestionCountInput").value =
      String(state.quizConfig.questionCount || 1);
  }

  state.quizConfig.points = Math.max(
    0,
    Math.min(100, Number(document.getElementById("quizPointsInput").value || 1))
  );
}

function validateQuizSetup() {
  syncQuizSetupInputs();

  if (state.quizConfig.questionStyle === "custom") {
    if (!state.quizConfig.template) {
      showMessage("Enter a custom question template.", "error");
      return false;
    }

    if (!state.quizConfig.template.includes("{term}")) {
      showMessage('Custom questions must include {term}.', "error");
      return false;
    }
  }

  if (state.quizConfig.inclusionMode === "manual" && !state.quizConfig.manualCardKeys.length) {
    showMessage("Select at least one flashcard for the quiz.", "error");
    return false;
  }

  return true;
}

function startConfiguredQuiz() {
  const pending = state.pendingQuiz;
  if (!pending) return;
  if (!validateQuizSetup()) return;

  const questions = buildQuizQuestions(
    pending.scope,
    pending.deckId,
    state.quizConfig
  );

  if (!questions.length) {
    showMessage("There are no cards available for this quiz.", "error");
    return;
  }

  state.quizQuestions = questions;
  state.quizIndex = 0;
  state.quizScore = 0;
  state.quizResults = [];
  state.quizAnswered = false;

  const title = pending.scope === "deck"
    ? state.decks.find(d => d.id === pending.deckId)?.name || "Deck Quiz"
    : state.selectedClass.name;

  document.getElementById("quizTitle").textContent = title;
  document.getElementById("quizScopeLabel").textContent =
    pending.scope === "deck" ? "Deck Quiz" : "Class Quiz";

  closeModals();
  showPanel("quizView");
  renderQuizQuestion();
}

function buildGoogleFormsGsSource(payload) {
  const embeddedQuiz = JSON.stringify(payload, null, 2);

  return `/**
 * Flashcards → Google Forms Quiz
 *
 * HOW TO USE
 * 1. Go to https://script.google.com and create a new project.
 * 2. Replace the starter code with this entire file.
 * 3. Save.
 * 4. Run createFlashcardsQuiz().
 * 5. Approve Google permissions the first time.
 * 6. Open the execution log for the Form URLs, or find the new Form in Google Drive.
 */

const FLASHCARDS_QUIZ = ${embeddedQuiz};

function createFlashcardsQuiz() {
  const quiz = FLASHCARDS_QUIZ;

  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) {
    throw new Error("No quiz questions were found.");
  }

  const pointsEach = normalizePoints_(quiz.pointsEach);
  const form = FormApp.create(quiz.title || "Flashcards Quiz");

  form
    .setIsQuiz(true)
    .setDescription(
      "Created from Flashcards" +
      (quiz.className ? " — " + quiz.className : "") +
      ". " + quiz.questions.length + " question" +
      (quiz.questions.length === 1 ? "" : "s") + "."
    )
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setConfirmationMessage("Your quiz has been submitted.");

  let typedCount = 0;

  quiz.questions.forEach(function(question, index) {
    const prompt = cleanText_(question.prompt);
    const answer = cleanText_(question.answer);
    const deckName = cleanText_(question.deckName);

    if (!prompt) throw new Error("Question " + (index + 1) + " has no question text.");
    if (!answer) throw new Error("Question " + (index + 1) + " has no answer.");

    if (
      question.type === "multiple" &&
      Array.isArray(question.options) &&
      question.options.length >= 2
    ) {
      addMultipleChoiceQuestion_(form, prompt, answer, question.options, deckName, pointsEach);
    } else {
      typedCount += 1;
      addTypedQuestion_(form, prompt, answer, deckName, pointsEach);
    }
  });

  const editUrl = form.getEditUrl();
  const studentUrl = form.getPublishedUrl();

  console.log("Google Form Quiz created.");
  console.log("EDIT URL: " + editUrl);
  console.log("STUDENT URL: " + studentUrl);

  if (typedCount) {
    console.log(
      "NOTE: " + typedCount +
      " typed-answer question(s) were created. Review them in Google Forms if you want automatic grading."
    );
  }

  return editUrl;
}

function addMultipleChoiceQuestion_(form, prompt, answer, options, deckName, points) {
  const unique = uniqueStrings_(options);
  const answerKey = normalize_(answer);

  if (!unique.some(function(value) { return normalize_(value) === answerKey; })) {
    unique.push(answer);
  }

  if (unique.length < 2) {
    addTypedQuestion_(form, prompt, answer, deckName, points);
    return;
  }

  const item = form.addMultipleChoiceItem();
  item.setTitle(prompt).setRequired(true).setPoints(points);

  if (deckName) item.setHelpText("Deck: " + deckName);

  item.setChoices(
    unique.map(function(value) {
      return item.createChoice(value, normalize_(value) === answerKey);
    })
  );

  item
    .setFeedbackForCorrect(FormApp.createFeedback().setText("Correct.").build())
    .setFeedbackForIncorrect(
      FormApp.createFeedback().setText("Correct answer: " + answer).build()
    );
}

function addTypedQuestion_(form, prompt, answer, deckName, points) {
  const item = form.addTextItem();
  item.setTitle(prompt).setRequired(true).setPoints(points);

  if (deckName) item.setHelpText("Deck: " + deckName);

  item.setGeneralFeedback(
    FormApp.createFeedback().setText("Answer key: " + answer).build()
  );
}

function normalizePoints_(value) {
  let n = Number(value);
  if (!isFinite(n)) n = 1;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cleanText_(value) {
  return String(value == null ? "" : value).trim();
}

function normalize_(value) {
  return cleanText_(value).toLowerCase().replace(/\\s+/g, " ");
}

function uniqueStrings_(values) {
  const seen = {};
  const result = [];

  (values || []).forEach(function(value) {
    const text = cleanText_(value);
    const key = normalize_(text);

    if (!text || seen[key]) return;

    seen[key] = true;
    result.push(text);
  });

  return result;
}
`;
}

function safeFileName(value) {
  return String(value || "flashcards-quiz")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "flashcards-quiz";
}

function buildGsQuizPayload() {
  if (!state.pendingQuiz) return null;

  const questions = buildQuizQuestions(
    state.pendingQuiz.scope,
    state.pendingQuiz.deckId,
    state.quizConfig
  );

  if (!questions.length) return null;

  const targetTitle =
    state.pendingQuiz.scope === "deck"
      ? `${state.decks.find(d => d.id === state.pendingQuiz.deckId)?.name || "Flashcards"} Quiz`
      : `${state.selectedClass.name} Quiz`;

  return {
    source: "Flashcards",
    version: 1,
    title: targetTitle,
    className: state.selectedClass.name,
    pointsEach: state.quizConfig.points,
    questions: questions.map(q => ({
      prompt: q.prompt,
      answer: q.answer,
      type: q.type,
      options: Array.isArray(q.options) ? q.options : [],
      deckName: q.deckName || ""
    }))
  };
}

function resetGoogleFormsGeneratedScript() {
  state.generatedGoogleFormsScript = "";
  state.generatedGoogleFormsFileName = "";
  state.generatedGoogleFormsQuestionCount = 0;

  const resultBox = document.getElementById("googleFormsExportResult");
  const preview = document.getElementById("googleFormsScriptPreview");
  const summary = document.getElementById("googleFormsGeneratedSummary");
  const status = document.getElementById("googleFormsExportStatus");

  resultBox?.classList.add("hidden");
  if (preview) preview.value = "";
  if (summary) summary.textContent = "Choose Copy Script or Download .gs.";
  if (status) status.textContent = "";
}

function generateQuizGoogleFormsScript() {
  if (!isOwner()) {
    showMessage("Only the class owner can generate this quiz script.", "error");
    return;
  }

  if (!state.pendingQuiz) return;
  if (!validateQuizSetup()) return;

  const status = document.getElementById("googleFormsExportStatus");
  const resultBox = document.getElementById("googleFormsExportResult");
  const preview = document.getElementById("googleFormsScriptPreview");
  const summary = document.getElementById("googleFormsGeneratedSummary");
  const payload = buildGsQuizPayload();

  if (!payload) {
    resetGoogleFormsGeneratedScript();
    status.textContent = "There are no flashcards available to export.";
    return;
  }

  try {
    const source = buildGoogleFormsGsSource(payload);
    const fileName = `${safeFileName(payload.title)}.gs`;

    state.generatedGoogleFormsScript = source;
    state.generatedGoogleFormsFileName = fileName;
    state.generatedGoogleFormsQuestionCount = payload.questions.length;

    preview.value = source;
    summary.textContent =
      `${payload.questions.length} question${payload.questions.length === 1 ? "" : "s"} ready · ${fileName}`;
    resultBox.classList.remove("hidden");
    status.textContent = "Script generated. Copy it directly or download the .gs file.";

    showMessage("Google Forms script generated.", "success");
  } catch (err) {
    console.error(err);
    resetGoogleFormsGeneratedScript();
    status.textContent = `Generation failed: ${err?.message || "Unknown error"}`;
  }
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  helper.style.pointerEvents = "none";
  document.body.appendChild(helper);
  helper.select();
  helper.setSelectionRange(0, helper.value.length);

  const copied = document.execCommand("copy");
  helper.remove();

  if (!copied) throw new Error("Copy was blocked by the browser.");
}

async function copyGeneratedGoogleFormsScript() {
  const source = state.generatedGoogleFormsScript;
  const status = document.getElementById("googleFormsExportStatus");

  if (!source) {
    status.textContent = "Generate the Google Forms script first.";
    return;
  }

  try {
    await writeTextToClipboard(source);
    status.textContent =
      `Copied ${state.generatedGoogleFormsQuestionCount} question${state.generatedGoogleFormsQuestionCount === 1 ? "" : "s"} as Google Apps Script.`;
    showMessage("Google Forms script copied.", "success");
  } catch (err) {
    console.error(err);
    status.textContent = `Copy failed: ${err?.message || "Unknown error"}`;
  }
}

function downloadGeneratedGoogleFormsScript() {
  const source = state.generatedGoogleFormsScript;
  const status = document.getElementById("googleFormsExportStatus");

  if (!source) {
    status.textContent = "Generate the Google Forms script first.";
    return;
  }

  try {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = state.generatedGoogleFormsFileName || "flashcards-quiz.gs";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    status.textContent =
      `Downloaded ${state.generatedGoogleFormsQuestionCount} question${state.generatedGoogleFormsQuestionCount === 1 ? "" : "s"} as a Google Apps Script file.`;
    showMessage("Google Forms .gs script downloaded.", "success");
  } catch (err) {
    console.error(err);
    status.textContent = `Download failed: ${err?.message || "Unknown error"}`;
  }
}

function renderQuizQuestion() {
  const q = state.quizQuestions[state.quizIndex];

  if (!q) {
    finishQuiz();
    return;
  }

  state.quizAnswered = false;

  document.getElementById("quizQuestionCounter").textContent =
    `Question ${state.quizIndex + 1} of ${state.quizQuestions.length}`;
  document.getElementById("quizQuestionType").textContent =
    q.type === "multiple" ? "Multiple Choice" : "Type Answer";
  document.getElementById("quizQuestionText").textContent = q.prompt;
  document.getElementById("quizLiveScore").textContent =
    `${state.quizScore} / ${state.quizIndex}`;
  document.getElementById("quizProgressFill").style.width =
    `${(state.quizIndex / state.quizQuestions.length) * 100}%`;

  const choiceArea = document.getElementById("quizChoiceArea");
  const typingArea = document.getElementById("quizTypingArea");
  const typingInput = document.getElementById("quizTypingInput");

  choiceArea.innerHTML = "";
  choiceArea.classList.toggle("hidden", q.type !== "multiple");
  typingArea.classList.toggle("hidden", q.type !== "typed");

  document.getElementById("quizFeedback").classList.add("hidden");
  document.getElementById("quizNextBtn").classList.add("hidden");
  document.getElementById("quizCheckBtn").disabled = false;
  typingInput.disabled = false;
  typingInput.value = "";

  if (q.type === "multiple") {
    q.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "quiz-choice-btn";
      btn.dataset.quizChoice = option;
      btn.innerHTML = `
        <span class="quiz-choice-letter">${String.fromCharCode(65 + index)}</span>
        <span>${escapeHtml(option)}</span>
      `;
      choiceArea.appendChild(btn);
    });
  } else {
    setTimeout(() => typingInput.focus(), 0);
  }
}

function showQuizFeedback(correct, given, question) {
  const box = document.getElementById("quizFeedback");
  const title = document.getElementById("quizFeedbackTitle");
  const text = document.getElementById("quizFeedbackText");

  box.classList.remove("hidden", "correct", "incorrect");
  box.classList.add(correct ? "correct" : "incorrect");

  title.textContent = correct ? "Correct!" : "Not quite.";
  text.textContent = correct
    ? `Answer: ${question.answer}`
    : `Correct answer: ${question.answer}`;

  document.getElementById("quizNextBtn").classList.remove("hidden");
  document.getElementById("quizLiveScore").textContent =
    `${state.quizScore} / ${state.quizIndex + 1}`;
}

function answerQuizQuestion(given) {
  if (state.quizAnswered) return;

  const q = state.quizQuestions[state.quizIndex];
  if (!q) return;

  const cleanGiven = String(given ?? "").trim();
  if (!cleanGiven) {
    showMessage("Choose or type an answer first.", "error");
    return;
  }

  state.quizAnswered = true;

  const correct = normalizeText(cleanGiven) === normalizeText(q.answer);
  if (correct) state.quizScore += 1;

  state.quizResults.push({
    ...q,
    given: cleanGiven,
    correct
  });

  document.querySelectorAll(".quiz-choice-btn").forEach(btn => {
    btn.disabled = true;
    const value = btn.dataset.quizChoice;

    if (normalizeText(value) === normalizeText(q.answer)) {
      btn.classList.add("correct");
    } else if (normalizeText(value) === normalizeText(cleanGiven) && !correct) {
      btn.classList.add("incorrect");
    }
  });

  document.getElementById("quizTypingInput").disabled = true;
  document.getElementById("quizCheckBtn").disabled = true;

  showQuizFeedback(correct, cleanGiven, q);
}

function nextQuizQuestion() {
  if (!state.quizAnswered) return;
  state.quizIndex += 1;
  renderQuizQuestion();
}

async function saveQuizProgress() {
  const grouped = new Map();

  for (const result of state.quizResults) {
    if (!grouped.has(result.deckId)) {
      grouped.set(result.deckId, { answered: 0, correct: 0, deckName: result.deckName });
    }

    const group = grouped.get(result.deckId);
    group.answered += 1;
    if (result.correct) group.correct += 1;
  }

  for (const [deckId, group] of grouped.entries()) {
    let p = state.progressMap.get(deckId);

    if (!p) {
      p = {
        id: progressDocId(state.selectedClass.id, deckId, state.user.uid),
        classId: state.selectedClass.id,
        className: state.selectedClass.name,
        deckId,
        deckName: group.deckName,
        studentId: state.user.uid,
        studentName: isGuestStudent() ? guestStudentName() : (state.user.displayName || ""),
        studentEmail: isGuestStudent() ? "" : (state.user.email || ""),
        studied: 0,
        ratingCount: 0,
        ratingTotal: 0,
        cards: {},
        quizAnswered: 0,
        quizCorrect: 0
      };
    }

    p.quizAnswered = Number(p.quizAnswered || 0) + group.answered;
    p.quizCorrect = Number(p.quizCorrect || 0) + group.correct;
    state.progressMap.set(deckId, p);

    await setDoc(doc(state.db, "progress", p.id), {
      classId: state.selectedClass.id,
      className: state.selectedClass.name,
      deckId,
      deckName: group.deckName,
      studentId: state.user.uid,
      studentName: isGuestStudent() ? guestStudentName() : (state.user.displayName || ""),
      studentEmail: isGuestStudent() ? "" : (state.user.email || ""),
      quizAnswered: p.quizAnswered,
      quizCorrect: p.quizCorrect,
      lastQuizPercent: group.answered
        ? Math.round((group.correct / group.answered) * 100)
        : 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function finishQuiz() {
  const total = state.quizQuestions.length;
  const percent = total ? Math.round((state.quizScore / total) * 100) : 0;

  document.getElementById("quizResultsTitle").textContent =
    `${state.selectedClass.name} Quiz Results`;
  document.getElementById("quizResultsText").textContent =
    `You answered ${state.quizScore} of ${total} questions correctly.`;
  document.getElementById("quizCorrectCount").textContent =
    `${state.quizScore} / ${total}`;
  document.getElementById("quizPercent").textContent = `${percent}%`;

  const missed = state.quizResults.filter(r => !r.correct);
  const review = document.getElementById("quizReview");

  if (!missed.length) {
    review.innerHTML = `
      <div class="quiz-perfect">
        Perfect score — every answer was correct.
      </div>
    `;
  } else {
    review.innerHTML = `
      <div class="quiz-review-head">
        <span class="eyebrow">Review</span>
        <h3>Questions to review</h3>
      </div>
      ${missed.map(r => `
        <article class="quiz-review-item">
          <strong>${escapeHtml(r.prompt)}</strong>
          <span>Your answer: ${escapeHtml(r.given)}</span>
          <span>Correct answer: ${escapeHtml(r.answer)}</span>
        </article>
      `).join("")}
    `;
  }

  showPanel("quizCompleteView");

  try {
    await saveQuizProgress();
    await loadSidebarStats();
  } catch (err) {
    handleFirebaseError(err, "Quiz score was shown, but cloud progress could not be saved.");
  }
}

function tryQuizAgain() {
  state.quizIndex = 0;
  state.quizScore = 0;
  state.quizResults = [];
  state.quizAnswered = false;

  // Random order gets a fresh shuffle on each attempt.
  if (state.quizConfig.order === "random" && state.pendingQuiz) {
    state.quizQuestions = buildQuizQuestions(
      state.pendingQuiz.scope,
      state.pendingQuiz.deckId,
      state.quizConfig
    );
  }

  showPanel("quizView");
  renderQuizQuestion();
}

function prepareSession(title, label) {
  state.sessionIndex = 0;
  state.sessionRatings = [];

  document.getElementById("studyTitle").textContent = title;
  document.getElementById("studyDeckLabel").textContent = label;

  showPanel("studyView");
  renderStudyCard();
}

function renderStudyCard() {
  const card = state.sessionCards[state.sessionIndex];
  if (!card) {
    finishSession();
    return;
  }

  const direction = card._studyDirection || state.studyDirection || "frontBack";
  const question = direction === "backFront" ? card.back : card.front;
  const answer = direction === "backFront" ? card.front : card.back;

  document.getElementById("questionText").textContent = question;
  document.getElementById("answerText").textContent = answer;
  document.getElementById("cardCounter").textContent =
    `${state.sessionIndex + 1} of ${state.sessionCards.length}`;
  document.getElementById("studyProgressFill").style.width =
    `${(state.sessionIndex / state.sessionCards.length) * 100}%`;

  document.getElementById("answerArea").classList.add("hidden");
  document.getElementById("typingArea").classList.add("hidden");
  document.getElementById("revealBtn").classList.remove("hidden");
  document.getElementById("typingResult").textContent = "";
}

function toggleAnswerVisibility(forceState = null) {
  const answerArea = document.getElementById("answerArea");
  const revealBtn = document.getElementById("revealBtn");

  const currentlyVisible = !answerArea.classList.contains("hidden");
  const shouldShow = forceState === null ? !currentlyVisible : Boolean(forceState);

  answerArea.classList.toggle("hidden", !shouldShow);
  revealBtn.classList.toggle("hidden", shouldShow);
}

function revealAnswer() {
  toggleAnswerVisibility(true);
}

function studyViewIsOpen() {
  return !document.getElementById("studyView").classList.contains("hidden");
}

function answerIsVisible() {
  return !document.getElementById("answerArea").classList.contains("hidden");
}

function targetIsInteractive(target) {
  return Boolean(
    target.closest(
      "button, input, textarea, select, a, [contenteditable='true'], [data-rating]"
    )
  );
}

async function rateCurrentCard(rating) {
  const card = state.sessionCards[state.sessionIndex];
  if (!card) return;

  rating = Number(rating);

  let p = state.progressMap.get(card.deckId);

  if (!p) {
    p = {
      id: progressDocId(state.selectedClass.id, card.deckId, state.user.uid),
      classId: state.selectedClass.id,
      className: state.selectedClass.name,
      deckId: card.deckId,
      deckName: card.deckName,
      studentId: state.user.uid,
      studentName: isGuestStudent() ? guestStudentName() : (state.user.displayName || ""),
      studentEmail: isGuestStudent() ? "" : (state.user.email || ""),
      studied: 0,
      ratingCount: 0,
      ratingTotal: 0,
      cards: {}
    };
  }

  p.cards = p.cards || {};
  const cp = p.cards[card.id] || { count: 0, total: 0, seen: 0 };
  cp.count += 1;
  cp.total += rating;
  cp.seen += 1;
  p.cards[card.id] = cp;

  p.studied = Number(p.studied || 0) + 1;
  p.ratingCount = Number(p.ratingCount || 0) + 1;
  p.ratingTotal = Number(p.ratingTotal || 0) + rating;

  state.progressMap.set(card.deckId, p);
  state.sessionRatings.push(rating);

  try {
    await setDoc(doc(state.db, "progress", p.id), {
      classId: state.selectedClass.id,
      className: state.selectedClass.name,
      deckId: card.deckId,
      deckName: card.deckName,
      studentId: state.user.uid,
      studentName: isGuestStudent() ? guestStudentName() : (state.user.displayName || ""),
      studentEmail: isGuestStudent() ? "" : (state.user.email || ""),
      studied: p.studied,
      ratingCount: p.ratingCount,
      ratingTotal: p.ratingTotal,
      cards: p.cards,
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.sessionIndex += 1;
    renderStudyCard();
  } catch (err) {
    handleFirebaseError(err, "Progress could not be saved.");
  }
}

function finishSession() {
  const avg = state.sessionRatings.length
    ? state.sessionRatings.reduce((a, b) => a + b, 0) / state.sessionRatings.length
    : 0;

  const stats = currentClassStats();

  document.getElementById("completeCards").textContent = state.sessionRatings.length;
  document.getElementById("completeAverage").textContent = avg.toFixed(1);
  document.getElementById("completeMastery").textContent = `${stats.mastery}%`;
  document.getElementById("completeText").textContent =
    `You reviewed ${state.sessionRatings.length} card${state.sessionRatings.length === 1 ? "" : "s"} in ${state.selectedClass.name}.`;

  showPanel("completeView");
}

async function returnToClass() {
  await openClass(state.selectedClass.id);
}

function handleFirebaseError(err, fallback) {
  console.error(err);

  let message = fallback;

  if (err?.code === "permission-denied") {
    message = "Firebase blocked this request. Publish the new Firestore Rules included with this build.";
  } else if (err?.code === "auth/popup-blocked") {
    message = "Your browser blocked the Google sign-in popup. Allow popups and try again.";
  } else if (err?.code === "auth/unauthorized-domain") {
    message = "This website domain is not authorized in Firebase Authentication settings.";
  } else if (err?.message) {
    message = `${fallback} ${err.message}`;
  }

  showMessage(message, "error", 7000);
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    THEME_KEY,
    document.body.classList.contains("dark") ? "dark" : "light"
  );
}

function initTheme() {
  if (localStorage.getItem(THEME_KEY) === "dark") {
    document.body.classList.add("dark");
  }
}

async function initializeFirebase() {
  try {
    // Classroom Tools embeds Flashcards in an iframe. Give that embedded copy its
    // own named Firebase app so its login stays separate from the standalone
    // Flashcards page. Use local persistence so embedded Flashcards remembers
    // the teacher until they explicitly click Sign out.
    if (EMBEDDED_CLASSROOM_MODE) {
      state.app = initializeApp(firebaseConfig, "flashcardsClassroomToolsEmbedded");
      state.auth = initializeAuth(state.app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver
      });
    } else {
      state.app = initializeApp(firebaseConfig);
      state.auth = getAuth(state.app);
    }

    state.db = getFirestore(state.app);

    onAuthStateChanged(state.auth, async user => {
      state.user = user;

      try {
        await routeAfterAuth();
      } catch (err) {
        handleFirebaseError(err, "Could not load Flashcards.");
      }
    });
  } catch (err) {
    console.error(err);
    showTopView("loginView");
    showMessage("Firebase could not initialize.", "error", 0);
  }
}

document.addEventListener("click", async e => {
  const sidebarMenuButton = e.target.closest("[data-sidebar-menu-button]");
  if (sidebarMenuButton) {
    e.preventDefault();
    e.stopPropagation();
    const classId = sidebarMenuButton.dataset.sidebarMenuButton;
    const menu = document.getElementById("sidebarClassMenu");
    if (!menu.hidden && state.sidebarMenuClassId === classId) {
      closeSidebarClassMenu();
    } else {
      openSidebarClassMenu(sidebarMenuButton, classId);
    }
    return;
  }

  const sidebarMenuAction = e.target.closest("[data-sidebar-menu-action]");
  if (sidebarMenuAction) {
    e.preventDefault();
    e.stopPropagation();
    const classId = state.sidebarMenuClassId;
    const action = sidebarMenuAction.dataset.sidebarMenuAction;
    closeSidebarClassMenu();
    if (!classId) return;

    if (action === "share") return openSidebarShareModal(classId);
    if (action === "duplicate") return duplicateClassById(classId);
    if (action === "archive") return archiveClassById(classId);
    if (action === "delete") return deleteOwnedClassPermanently(classId);
    return;
  }

  if (!e.target.closest("#sidebarClassMenu")) {
    closeSidebarClassMenu();
  }

  const sidebarClass = e.target.closest("[data-sidebar-class]");
  if (sidebarClass) {
    return openClass(sidebarClass.dataset.sidebarClass);
  }

  const libraryClass = e.target.closest("[data-library-class]");
  if (libraryClass) {
    return openClass(libraryClass.dataset.libraryClass);
  }

  const tab = e.target.closest("[data-tab]");
  if (tab) {
    return setTab(tab.dataset.tab);
  }

  const editDeck = e.target.closest("[data-edit-deck]");
  if (editDeck) {
    return openEditDeck(editDeck.dataset.editDeck);
  }

  const copyCardsDeck = e.target.closest("[data-copy-cards-to-deck]");
  if (copyCardsDeck) {
    return openCopyCards(copyCardsDeck.dataset.copyCardsToDeck);
  }

  const toggleDeckVisibilityBtn = e.target.closest("[data-toggle-deck-visibility]");
  if (toggleDeckVisibilityBtn) {
    return toggleDeckVisibility(toggleDeckVisibilityBtn.dataset.toggleDeckVisibility);
  }

  const viewDeckList = e.target.closest("[data-view-deck-list]");
  if (viewDeckList) {
    return openDeckList(viewDeckList.dataset.viewDeckList);
  }

  const studyDeck = e.target.closest("[data-study-deck]");
  if (studyDeck) {
    return chooseStudyOrder("deck", studyDeck.dataset.studyDeck);
  }

  const quizDeck = e.target.closest("[data-quiz-deck]");
  if (quizDeck) {
    return chooseQuizSetup("deck", quizDeck.dataset.quizDeck);
  }

  const quizSettingBtn = e.target.closest(".quiz-setting-btn");
  if (quizSettingBtn) {
    const group = quizSettingBtn.closest("[data-quiz-setting]");
    const setting = group.dataset.quizSetting;

    state.quizConfig[setting] = quizSettingBtn.dataset.value;
    resetGoogleFormsGeneratedScript();

    group.querySelectorAll(".quiz-setting-btn").forEach(btn => {
      btn.classList.toggle("active", btn === quizSettingBtn);
    });

    if (setting === "questionStyle") {
      const custom = quizSettingBtn.dataset.value === "custom";
      document.getElementById("quizTemplateField").classList.toggle("hidden", !custom);

      if (custom) {
        setTimeout(() => document.getElementById("quizTemplateInput").focus(), 0);
      }
    }

    if (setting === "inclusionMode") {
      syncQuizInclusionUi();
    }

    return;
  }

  const quizChoice = e.target.closest("[data-quiz-choice]");
  if (quizChoice) {
    return answerQuizQuestion(quizChoice.dataset.quizChoice);
  }

  const rating = e.target.closest("[data-rating]");
  if (rating) {
    return rateCurrentCard(rating.dataset.rating);
  }

  if (e.target.matches('#copyCardsList input[data-copy-card-index]')) {
    updateCopySelectionCount();
  }

  const restoreClassBtn = e.target.closest("[data-restore-class]");
  if (restoreClassBtn) {
    return restoreArchivedClass(restoreClassBtn.dataset.restoreClass);
  }

  const deleteArchivedClassBtn = e.target.closest("[data-delete-archived-class]");
  if (deleteArchivedClassBtn) {
    return deleteArchivedClassPermanently(
      deleteArchivedClassBtn.dataset.deleteArchivedClass
    );
  }

  const restoreDeckBtn = e.target.closest("[data-restore-deck]");
  if (restoreDeckBtn) {
    const [classId, deckId] = restoreDeckBtn.dataset.restoreDeck.split(":");
    return restoreArchivedDeck(classId, deckId);
  }

  const removeLearnerBtn = e.target.closest("[data-remove-learner]");
  if (removeLearnerBtn) {
    return openRemoveLearnerModal(removeLearnerBtn.dataset.removeLearner);
  }

  if (e.target.closest("#removeSelectedLearnersBtn")) {
    return openRemoveSelectedLearnersModal();
  }

  if (e.target.closest("#removeAllLearnersBtn")) {
    return openRemoveAllLearnersModal();
  }

  if (e.target.closest("[data-close-modal]")) {
    closeModals();
  }
});

document.addEventListener("change", e => {
  if (e.target.matches("#selectAllLearnersCheckbox")) {
    setAllLearnersSelected(e.target.checked);
    return;
  }

  if (e.target.matches("[data-select-learner]")) {
    toggleLearnerSelection(e.target.dataset.selectLearner, e.target.checked);
  }
});

document.addEventListener("dragstart", e => {
  const handle = e.target.closest("[data-sidebar-drag-handle]");
  if (!handle) return;

  const classId = handle.dataset.sidebarDragHandle;
  state.sidebarDraggedClassId = classId;
  closeSidebarClassMenu();

  const row = handle.closest("[data-sidebar-drop-row]");
  row?.classList.add("dragging");

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", classId);
  }
});

document.addEventListener("dragover", e => {
  const row = e.target.closest("[data-sidebar-drop-row]");
  if (!row || !state.sidebarDraggedClassId) return;
  if (row.dataset.sidebarDropRow === state.sidebarDraggedClassId) return;

  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  document.querySelectorAll(".sidebar-class-row").forEach(other => {
    if (other !== row) other.classList.remove("drag-over-before", "drag-over-after");
  });

  const rect = row.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  row.classList.toggle("drag-over-before", !after);
  row.classList.toggle("drag-over-after", after);
});

document.addEventListener("dragleave", e => {
  const row = e.target.closest("[data-sidebar-drop-row]");
  if (!row) return;
  const related = e.relatedTarget;
  if (related && row.contains(related)) return;
  row.classList.remove("drag-over-before", "drag-over-after");
});

document.addEventListener("drop", async e => {
  const row = e.target.closest("[data-sidebar-drop-row]");
  if (!row || !state.sidebarDraggedClassId) return;

  e.preventDefault();
  const draggedId = state.sidebarDraggedClassId;
  const targetId = row.dataset.sidebarDropRow;
  const rect = row.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;

  clearSidebarDragMarkers();
  state.sidebarDraggedClassId = null;
  await reorderSidebarClass(draggedId, targetId, after);
});

document.addEventListener("dragend", () => {
  clearSidebarDragMarkers();
  state.sidebarDraggedClassId = null;
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSidebarClassMenu();
});

window.addEventListener("resize", closeSidebarClassMenu);
window.addEventListener("scroll", closeSidebarClassMenu, true);

document.getElementById("googleSignInBtn").addEventListener("click", signInGoogle);
document.getElementById("sharedGoogleSignInBtn").addEventListener("click", signInGoogle);

document.getElementById("signOutBtn").addEventListener("click", async () => {
  if (isGuestStudent()) clearClassParam();
  await signOut(state.auth);
});

document.getElementById("sidebarSettingsBtn").addEventListener("click", toggleTheme);

document.getElementById("newClassSidebarBtn").addEventListener("click", () => openModal("newClassModal"));
document.getElementById("newClassMainBtn").addEventListener("click", () => openModal("newClassModal"));
document.getElementById("createClassBtn").addEventListener("click", createClass);

document.getElementById("editClassBtn").addEventListener("click", openEditClass);
document.getElementById("editIntroBtn").addEventListener("click", openEditClass);
document.getElementById("saveClassBtn").addEventListener("click", saveClassChanges);
document.getElementById("openArchiveBtn").addEventListener("click", openArchiveManager);

document.getElementById("sidebarShareLinkNameInput").addEventListener("input", syncSidebarShareModal);
document.getElementById("sidebarShareUseClassNameBtn").addEventListener("click", useClassNameInSidebarShare);
document.getElementById("sidebarShareSaveNameBtn").addEventListener("click", saveSidebarShareLinkName);
document.getElementById("sidebarShareCopyLinkBtn").addEventListener("click", copySidebarShareLink);
document.getElementById("sidebarShareLinkNameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    copySidebarShareLink();
  }
});

document.getElementById("shareClassBtn").addEventListener("click", () => copyClassLink());
document.getElementById("linkPreviewSaveTitleBtn").addEventListener("click", saveLinkPreviewTitle);
document.getElementById("linkPreviewUseClassNameBtn").addEventListener("click", useClassNameForLinkPreview);
document.getElementById("linkPreviewTitleInput").addEventListener("input", () => {
  const status = document.getElementById("linkPreviewTitleStatus");
  if (status) status.textContent = "This name will become the &name= value in the copied link. Click Save if you want to remember it.";
  scheduleClassroomShareRender();
});
document.getElementById("linkPreviewTitleInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    copyClassLink();
  }
});
document.getElementById("classroomSaveShareTitleBtn").addEventListener("click", saveClassroomShareTitle);
document.getElementById("classroomUseClassNameBtn").addEventListener("click", useClassNameForClassroomShare);
document.getElementById("classroomShareTitleInput").addEventListener("input", () => {
  const status = document.getElementById("classroomShareTitleStatus");
  if (status) status.textContent = "Preview updated. Click Save Title if you want to remember this title.";
  scheduleClassroomShareRender();
});
document.getElementById("classroomShareTitleInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveClassroomShareTitle();
  }
});
document.getElementById("removeSharedClassBtn").addEventListener("click", removeSharedClass);

document.getElementById("newDeckBtn").addEventListener("click", openNewDeck);
document.getElementById("createDeckBtn").addEventListener("click", createDeck);
document.getElementById("loadSampleBtn").addEventListener("click", () => {
  document.getElementById("newDeckName").value = sampleDeck.name;
  document.getElementById("newDeckCards").value = sampleDeck.text;
});

document.getElementById("saveDeckBtn").addEventListener("click", saveDeckChanges);
document.getElementById("archiveDeckBtn").addEventListener("click", archiveCurrentDeck);
document.getElementById("deleteDeckBtn").addEventListener("click", deleteCurrentDeck);

document.getElementById("copySourceClassSelect").addEventListener("change", e => {
  loadCopySourceDecks(e.target.value);
});
document.getElementById("copySourceDeckSelect").addEventListener("change", loadCopySourceCards);
document.getElementById("copySelectAllBtn").addEventListener("click", () => {
  document.querySelectorAll(
    '#copyCardsList input[data-copy-card-index]'
  ).forEach(input => {
    input.checked = true;
  });
  updateCopySelectionCount();
});
document.getElementById("copyClearSelectionBtn").addEventListener("click", () => {
  document.querySelectorAll(
    '#copyCardsList input[data-copy-card-index]'
  ).forEach(input => {
    input.checked = false;
  });
  updateCopySelectionCount();
});
document.getElementById("copySelectedCardsBtn").addEventListener(
  "click",
  copySelectedCards
);

document.getElementById("selectAllStudyDecks").addEventListener("change", e => {
  if (e.target.checked) {
    state.selectedStudyDeckIds = new Set(studyableDecks().map(deck => deck.id));
  } else {
    state.selectedStudyDeckIds.clear();
  }
  renderDeckRows();
});

document.getElementById("clearDeckSelectionBtn").addEventListener("click", () => {
  state.selectedStudyDeckIds.clear();
  renderDeckRows();
});

document.getElementById("studySelectedDecksBtn").addEventListener("click", () => {
  const deckIds = selectedStudyDecks().map(deck => deck.id);
  if (!deckIds.length) return;
  chooseStudyOrder("selection", null, deckIds);
});

document.getElementById("deckRows").addEventListener("change", e => {
  const input = e.target.closest("[data-select-study-deck]");
  if (!input) return;
  const deckId = input.dataset.selectStudyDeck;
  if (input.checked) {
    state.selectedStudyDeckIds.add(deckId);
  } else {
    state.selectedStudyDeckIds.delete(deckId);
  }
  updateDeckStudySelectionUi();
});

document.getElementById("studyClassBtn").addEventListener("click", () => chooseStudyOrder("class"));
document.getElementById("quizClassBtn").addEventListener("click", () => chooseQuizSetup("class"));
document.getElementById("startQuizBtn").addEventListener("click", startConfiguredQuiz);
document.getElementById("saveQuizDefaultBtn").addEventListener("click", saveQuizDefaults);
document.getElementById("resetQuizDefaultBtn").addEventListener("click", resetQuizDefaults);
document.getElementById("exportGoogleFormsBtn").addEventListener("click", generateQuizGoogleFormsScript);
document.getElementById("copyGoogleFormsScriptBtn").addEventListener("click", copyGeneratedGoogleFormsScript);
document.getElementById("downloadGoogleFormsScriptBtn").addEventListener("click", downloadGeneratedGoogleFormsScript);
document.getElementById("quizTemplateInput").addEventListener("input", e => {
  state.quizConfig.template = e.target.value;
  resetGoogleFormsGeneratedScript();
});
document.getElementById("quizQuestionCountInput").addEventListener("input", e => {
  if (!state.pendingQuiz) return;
  const availableCount = collectQuizCards(
    state.pendingQuiz.scope,
    state.pendingQuiz.deckId
  ).length;
  const value = Number(e.target.value);
  if (Number.isFinite(value) && value > 0) {
    state.quizConfig.questionCount = Math.min(availableCount, Math.floor(value));
    state.quizConfig.questionCountMode = "fixed";
    resetGoogleFormsGeneratedScript();
  }
});
document.getElementById("quizUseAllQuestionsBtn").addEventListener("click", () => {
  if (!state.pendingQuiz) return;
  const availableCount = collectQuizCards(
    state.pendingQuiz.scope,
    state.pendingQuiz.deckId
  ).length;
  state.quizConfig.questionCount = availableCount;
  state.quizConfig.questionCountMode = "all";
  document.getElementById("quizQuestionCountInput").value = String(availableCount);
  resetGoogleFormsGeneratedScript();
});

document.getElementById("quizManualSelectAllBtn").addEventListener("click", () => {
  state.quizConfig.manualCardKeys = availableQuizCards().map(quizCardKey);
  renderManualQuizPicker();
  resetGoogleFormsGeneratedScript();
});

document.getElementById("quizManualClearBtn").addEventListener("click", () => {
  state.quizConfig.manualCardKeys = [];
  renderManualQuizPicker();
  resetGoogleFormsGeneratedScript();
});

document.getElementById("quizManualCardList").addEventListener("change", e => {
  const checkbox = e.target.closest("input[data-quiz-manual-card]");
  if (!checkbox) return;

  const selected = new Set(state.quizConfig.manualCardKeys || []);
  const key = checkbox.dataset.quizManualCard;

  if (checkbox.checked) selected.add(key);
  else selected.delete(key);

  state.quizConfig.manualCardKeys = [...selected];
  document.getElementById("quizManualSelectionCount").textContent =
    `${selected.size} of ${availableQuizCards().length} selected`;
  resetGoogleFormsGeneratedScript();
});

document.getElementById("quizPointsInput").addEventListener("input", e => {
  const value = Math.max(0, Math.min(100, Number(e.target.value || 1)));
  state.quizConfig.points = value;
  resetGoogleFormsGeneratedScript();
});
document.getElementById("quizCheckBtn").addEventListener("click", () => {
  answerQuizQuestion(document.getElementById("quizTypingInput").value);
});
document.getElementById("quizTypingInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    answerQuizQuestion(e.target.value);
  }
});
document.getElementById("quizNextBtn").addEventListener("click", nextQuizQuestion);
document.getElementById("exitQuizBtn").addEventListener("click", returnToClass);
document.getElementById("quizBackToClassBtn").addEventListener("click", returnToClass);
document.getElementById("quizTryAgainBtn").addEventListener("click", tryQuizAgain);

document.getElementById("refreshLearnersBtn").addEventListener("click", loadLearners);
document.getElementById("confirmRemoveLearnerBtn").addEventListener("click", confirmRemoveLearner);

document.getElementById("revealBtn").addEventListener("click", e => {
  e.stopPropagation();
  toggleAnswerVisibility();
});
document.getElementById("exitStudyBtn").addEventListener("click", returnToClass);
document.getElementById("studyAgainBtn").addEventListener("click", () => {
  if (state.studyScope === "class") {
    startClassStudy(state.studyOrder, state.studyDirection);
  } else if (state.studyScope === "selection") {
    startSelectedDecksStudy(state.studySelectionDeckIds, state.studyOrder, state.studyDirection);
  } else if (state.selectedDeck) {
    startDeckStudy(state.selectedDeck.id, state.studyOrder, state.studyDirection);
  }
});
document.getElementById("completeBackBtn").addEventListener("click", returnToClass);

// Typing controls are retained for later expansion, but current Brainscape-style study uses reveal + confidence.
document.getElementById("checkTypingBtn").addEventListener("click", () => {
  const card = state.sessionCards[state.sessionIndex];
  if (!card) return;

  const given = document.getElementById("typingInput").value.trim();
  const result = document.getElementById("typingResult");

  if (!given) {
    result.textContent = "Type an answer first.";
    result.className = "typing-result incorrect";
    return;
  }

  const direction = card._studyDirection || state.studyDirection || "frontBack";
  const expected = direction === "backFront" ? card.front : card.back;
  const correct = normalizeText(given) === normalizeText(expected);
  result.textContent = correct ? "Correct!" : "Not quite.";
  result.className = `typing-result ${correct ? "correct" : "incorrect"}`;
  document.getElementById("answerArea").classList.remove("hidden");
});

// Click anywhere on the flashcard surface to reveal/hide the answer.
// Interactive controls are excluded so rating buttons and inputs do not toggle the card.
document.querySelector(".study-card").addEventListener("click", e => {
  if (!studyViewIsOpen()) return;
  if (targetIsInteractive(e.target)) return;

  toggleAnswerVisibility();
});

// Keyboard study controls:
// Space = reveal/hide answer.
// Number keys 1-5 = submit confidence rating while the answer is visible.
document.addEventListener("keydown", e => {
  if (!studyViewIsOpen()) return;

  const active = document.activeElement;
  const tag = active?.tagName?.toLowerCase();

  if (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    active?.isContentEditable
  ) {
    return;
  }

  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    toggleAnswerVisibility();
    return;
  }

  if (!["1", "2", "3", "4", "5"].includes(e.key)) return;
  if (!answerIsVisible()) return;

  e.preventDefault();
  rateCurrentCard(Number(e.key));
});


document.querySelectorAll("[data-study-direction]").forEach(button => {
  button.addEventListener("click", () => {
    state.studyDirection = button.dataset.studyDirection || "frontBack";
    document.querySelectorAll("[data-study-direction]").forEach(btn => {
      btn.classList.toggle("active", btn === button);
    });
  });
});

document.getElementById("progressiveOrderBtn").addEventListener("click", () => {
  beginPendingStudy("progressive");
});

document.getElementById("randomOrderBtn").addEventListener("click", () => {
  beginPendingStudy("random");
});

document.getElementById("modalBackdrop").addEventListener("click", e => {
  if (e.target.id === "modalBackdrop") {
    closeModals();
  }
});

window.addEventListener("popstate", routeAfterAuth);

initTheme();
initializeFirebase();
