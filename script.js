const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FAVORITES_STORAGE_KEY = "favoriteIdeas";
const EXCLUSIVE_OPTIONS = {
  timeAvailable: "Full-time",
  locationType: "Online only"
};

const FIELD_CONFIG = {
  skillLevel: {
    type: "single",
    required: true,
    message: "Please choose one skill level."
  },
  mainSkills: {
    type: "multiple",
    required: true,
    message: "Please select at least one main skill."
  },
  budget: {
    type: "single",
    required: true,
    message: "Please choose one budget option."
  },
  timeAvailable: {
    type: "multiple",
    required: true,
    message: "Please choose at least one time option."
  },
  preferredBusinessType: {
    type: "multiple",
    required: true,
    message: "Please select at least one preferred business type."
  },
  interests: {
    type: "multiple",
    required: true,
    message: "Please select at least one interest."
  },
  locationType: {
    type: "multiple",
    required: true,
    message: "Please select at least one location type."
  },
  targetCustomer: {
    type: "single",
    required: true,
    message: "Please choose one target customer."
  },
  goalStyle: {
    type: "single",
    required: true,
    message: "Please choose one goal style."
  },
  problemToSolve: {
    type: "multiple",
    required: false,
    message: ""
  }
};

const elements = {
  form: document.getElementById("ideaForm"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  regenerateBtn: document.getElementById("regenerateBtn"),
  alertContainer: document.getElementById("alertContainer"),
  loadingSection: document.getElementById("loadingSection"),
  resultsSection: document.getElementById("resultsSection"),
  resultsGrid: document.getElementById("resultsGrid"),
  resultsModeBadge: document.getElementById("resultsModeBadge"),
  favoritesSection: document.getElementById("favoritesSection"),
  favoritesGrid: document.getElementById("favoritesGrid"),
  favoritesCountBadge: document.getElementById("favoritesCountBadge"),
  emptyState: document.getElementById("emptyState")
};

const groups = Object.fromEntries(
  Object.keys(FIELD_CONFIG).map((name) => [
    name,
    {
      fieldset: document.querySelector(`[data-group="${name}"]`),
      feedback: document.getElementById(`${name}Feedback`)
    }
  ])
);

let isLoading = false;
let favoriteIdeas = loadFavoriteIdeas();

init();

function init() {
  bindEvents();
  initializeUiEnhancements();
  renderFavoriteIdeas();
}

function bindEvents() {
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitIdeas();
  });

  elements.regenerateBtn.addEventListener("click", async () => {
    await submitIdeas();
  });

  elements.resetBtn.addEventListener("click", () => {
    resetFormAndResults();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (!(target.name in FIELD_CONFIG)) {
      return;
    }

    clearGroupError(target.name);
  });
}

async function submitIdeas() {
  const data = getFormData();
  const validation = validateForm(data);

  if (!validation.isValid) {
    showError(validation.message);
    return;
  }

  await handleIdeaGeneration(data);
}

async function handleIdeaGeneration(data) {
  if (isLoading) {
    return;
  }

  clearError();
  showLoading(true);

  try {
    const result = await generateIdeas(data);
    renderIdeas(result.ideas);
    setResultsMode(result.mode);
  } catch (error) {
    console.error(error);
    showError(error.message || "Something went wrong while generating ideas.");
    elements.resultsSection.classList.add("d-none");
    elements.resultsGrid.innerHTML = "";
    elements.emptyState.classList.remove("d-none");
  } finally {
    showLoading(false);
  }
}

function getFormData() {
  return Object.fromEntries(
    Object.entries(FIELD_CONFIG).map(([name, config]) => [
      name,
      config.type === "single" ? getSingleValue(name) : getMultipleValues(name)
    ])
  );
}

function validateForm(data) {
  clearFieldValidation();
  Object.keys(FIELD_CONFIG).forEach(clearGroupError);

  let isValid = true;

  Object.entries(FIELD_CONFIG).forEach(([name, config]) => {
    if (!config.required) {
      return;
    }

    const value = data[name];
    const isEmpty = Array.isArray(value) ? value.length === 0 : !value;

    if (isEmpty) {
      setGroupError(name, config.message);
      isValid = false;
    }
  });

  return {
    isValid,
    message: isValid ? "" : "Please complete all required fields before generating ideas."
  };
}

function buildPrompt(data) {
  return `You are a practical startup advisor. Generate exactly 3 realistic business ideas in valid JSON only.

Return this exact JSON shape and no extra text:
{
  "ideas": [
    {
      "title": "",
      "summary": "",
      "whyFitsUser": "",
      "whyItCouldWork": "",
      "howToStart": ["", "", ""],
      "monetization": "",
      "difficulty": "Easy | Medium | Hard",
      "startupCost": "Low | Medium | High"
    }
  ]
}

Rules:
- Return exactly 3 ideas.
- Ideas must be practical, realistic, and suitable for the user's background.
- Avoid ideas that require major capital, complex legal setup, or a large team unless the profile clearly supports that.
- Each howToStart array must contain 3 to 5 short bullet-style steps.
- Difficulty must be one of: Easy, Medium, Hard.
- StartupCost must be one of: Low, Medium, High.

User profile:
- Skill level: ${data.skillLevel}
- Main skills: ${data.mainSkills.join(", ")}
- Budget: ${data.budget}
- Time available: ${data.timeAvailable.join(", ")}
- Preferred business type: ${data.preferredBusinessType.join(", ")}
- Interests: ${data.interests.join(", ")}
- Location type: ${data.locationType.join(", ")}
- Target customer: ${data.targetCustomer}
- Goal style: ${data.goalStyle}
- Problem to solve: ${data.problemToSolve.length ? data.problemToSolve.join(", ") : "No specific preference"}
`;
}

async function generateIdeas(data) {
  if (!GEMINI_API_KEY.trim()) {
    return {
      ideas: getMockIdeas(data),
      mode: "Mock mode"
    };
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(data) }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(await buildApiError(response));
  }

  const responseData = await response.json();
  const responseText = responseData.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";

  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    ideas: parseIdeasResponse(responseText).ideas,
    mode: "Live Gemini mode"
  };
}

async function buildApiError(response) {
  let message = `Gemini request failed with status ${response.status}.`;

  try {
    const errorData = await response.json();
    const apiMessage = errorData.error?.message;

    if (apiMessage) {
      message = `Gemini request failed: ${apiMessage}`;
    }
  } catch (error) {
    console.warn("Could not parse Gemini error response.", error);
  }

  return message;
}

function getMockIdeas(data) {
  const profile = {
    skills: data.mainSkills.join(", "),
    interests: data.interests.join(", "),
    problem: data.problemToSolve[0] || "improve convenience",
    businessType: data.preferredBusinessType[0] || "Service",
    location: data.locationType[0] || "Online only",
    time: data.timeAvailable[0] || "Evenings"
  };

  return [
    {
      title: `${data.targetCustomer} Launch Support Studio`,
      summary: `A small ${profile.businessType.toLowerCase()} business that helps ${data.targetCustomer.toLowerCase()} solve everyday problems with fast, focused offers tailored to ${profile.interests.toLowerCase()}.`,
      whyFitsUser: `This idea matches your ${data.skillLevel.toLowerCase()} experience level, uses your strengths in ${profile.skills.toLowerCase()}, and fits a ${profile.time.toLowerCase()} schedule.`,
      whyItCouldWork: `Many ${data.targetCustomer.toLowerCase()} want affordable help that can ${profile.problem.toLowerCase()}. With your ${data.budget} budget and ${profile.location.toLowerCase()} setup, you can start lean and refine the offer quickly.`,
      howToStart: [
        `Choose one clear offer based on your strongest skills in ${profile.skills.toLowerCase()}.`,
        `Create a simple one-page service description and share it in spaces where ${data.targetCustomer.toLowerCase()} already spend time.`,
        "Interview 3 to 5 potential customers to learn what outcome matters most to them.",
        "Test the offer with a low-risk starter package and collect feedback after each client."
      ],
      monetization: "Charge flat-rate starter packages, upsell ongoing support, and offer premium custom add-ons once demand becomes clearer.",
      difficulty: "Easy",
      startupCost: "Low"
    },
    {
      title: `${profile.interests.split(",")[0]} Resource Kit for ${data.targetCustomer}`,
      summary: `A digital product business that packages templates, guides, or checklists for ${data.targetCustomer.toLowerCase()} who want faster results in ${profile.interests.toLowerCase()}.`,
      whyFitsUser: `It uses your background in ${profile.skills.toLowerCase()} and suits a ${data.goalStyle.toLowerCase()} goal because you can build once and improve over time.`,
      whyItCouldWork: "Digital resources are affordable to produce, easy to test online, and attractive to buyers who want to save time without hiring someone immediately.",
      howToStart: [
        `List the top questions ${data.targetCustomer.toLowerCase()} ask about ${profile.interests.toLowerCase()}.`,
        "Turn the best answer into a starter toolkit with a checklist, template, and short guide.",
        "Create a landing page with a strong problem-and-solution message and a sample preview.",
        "Promote the toolkit through short content, community posts, or direct outreach."
      ],
      monetization: "Sell one-time downloads, bundle multiple kits together, and add a higher-priced version with coaching or review services.",
      difficulty: "Medium",
      startupCost: "Low"
    },
    {
      title: `${profile.location} Convenience Micro-Business`,
      summary: `A focused business that helps ${data.targetCustomer.toLowerCase()} with a practical local-or-online solution designed around ${profile.problem.toLowerCase()}.`,
      whyFitsUser: `This works with your ${data.budget} budget, your interest in ${profile.interests.toLowerCase()}, and your preference for a ${profile.businessType.toLowerCase()} model.`,
      whyItCouldWork: "Convenience-driven offers are easier to explain and easier to sell because customers quickly understand the value. A small, well-defined niche can build traction without a large team.",
      howToStart: [
        `Identify one repeated inconvenience affecting ${data.targetCustomer.toLowerCase()} in a ${profile.location.toLowerCase()} setting.`,
        "Sketch a minimum version of the offer that can be delivered manually before automating anything.",
        "Validate pricing by comparing similar offers and asking 5 people what outcome they would pay for.",
        "Launch a simple booking, ordering, or inquiry form and promote it through a few targeted channels.",
        "Track what customers request most often and use that to improve the next version."
      ],
      monetization: "Earn revenue through service fees, subscription-style repeat packages, and partner referrals tied to the same customer need.",
      difficulty: "Medium",
      startupCost: data.budget === "$2,000+" ? "Medium" : "Low"
    }
  ];
}

function parseIdeasResponse(text) {
  const parsed = tryParseJson(text) || tryParseJson(extractJsonBlock(text));

  if (!parsed || typeof parsed !== "object") {
    throw new Error("The response format was invalid. The app could not find valid JSON.");
  }

  if (!Array.isArray(parsed.ideas) || parsed.ideas.length !== 3) {
    throw new Error("The response format was invalid. Expected exactly 3 ideas.");
  }

  return {
    ideas: parsed.ideas.map(normalizeIdea)
  };
}

function renderIdeas(ideas) {
  elements.resultsGrid.innerHTML = "";

  ideas.forEach((idea, index) => {
    const column = document.createElement("div");
    column.className = "col-12";
    column.appendChild(createIdeaCard(idea, index, false));
    elements.resultsGrid.appendChild(column);
  });

  elements.emptyState.classList.add("d-none");
  elements.resultsSection.classList.remove("d-none");
  elements.regenerateBtn.classList.remove("d-none");
}

function createIdeaCard(idea, index, isFavoriteView) {
  const card = document.createElement("article");
  const ideaKey = getIdeaKey(idea);
  const favorite = isIdeaFavorite(idea);

  card.className = "card idea-card border-0";
  card.dataset.ideaKey = ideaKey;

  card.innerHTML = `
    <div class="card-body p-4">
      <div class="idea-card-header">
        <div class="idea-card-title-wrap">
          <span class="text-uppercase small fw-semibold text-primary">Idea ${index + 1}</span>
          <h3 class="h4 mt-1 mb-0">${escapeHtml(idea.title)}</h3>
        </div>
      </div>

      <div class="idea-card-preview">
        <p class="idea-card-preview-copy">${escapeHtml(idea.summary)}</p>
        <div class="idea-quick-facts">
          <div class="idea-quick-fact">
            <span class="idea-quick-fact-label">Difficulty</span>
            <span class="meta-badge difficulty-${idea.difficulty.toLowerCase()}">${escapeHtml(idea.difficulty)}</span>
          </div>
          <div class="idea-quick-fact">
            <span class="idea-quick-fact-label">Startup Cost</span>
            <span class="meta-badge cost-${idea.startupCost.toLowerCase()}">${escapeHtml(idea.startupCost)}</span>
          </div>
        </div>
      </div>

      <div class="idea-card-details">
        <div class="mb-3">
          <div class="idea-section-title">Concept Summary</div>
          <p class="mb-0 text-secondary">${escapeHtml(idea.summary)}</p>
        </div>
        <div class="mb-3">
          <div class="idea-section-title">Why This Fits You</div>
          <p class="mb-0 text-secondary">${escapeHtml(idea.whyFitsUser)}</p>
        </div>
        <div class="mb-3">
          <div class="idea-section-title">Why It Could Work</div>
          <p class="mb-0 text-secondary">${escapeHtml(idea.whyItCouldWork)}</p>
        </div>
        <div class="mb-3">
          <div class="idea-section-title">How to Start</div>
          <ul class="mb-0 text-secondary">
            ${idea.howToStart.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ul>
        </div>
        <div class="mb-0">
          <div class="idea-section-title">How It Makes Money</div>
          <p class="mb-0 text-secondary">${escapeHtml(idea.monetization)}</p>
        </div>
      </div>

      <div class="idea-card-actions">
        <button type="button" class="btn btn-primary idea-toggle-btn">Read More</button>
        <button type="button" class="btn btn-outline-dark idea-favorite-btn">${favorite ? "Remove Favorite" : "Add to Favorite"}</button>
        <button type="button" class="btn btn-outline-primary idea-copy-btn">Copy Idea</button>
      </div>
    </div>
  `;

  card.querySelector(".idea-toggle-btn").addEventListener("click", () => {
    card.classList.toggle("is-expanded");
    card.querySelector(".idea-toggle-btn").textContent = card.classList.contains("is-expanded") ? "Close" : "Read More";
  });

  card.querySelector(".idea-favorite-btn").addEventListener("click", () => {
    const isFavorite = toggleFavoriteIdea(idea);
    updateFavoriteButtons(ideaKey, isFavorite);

    if (isFavoriteView && !isFavorite) {
      card.closest(".col-12")?.remove();
    }
  });

  card.querySelector(".idea-copy-btn").addEventListener("click", async () => {
    await copyIdeaToClipboard(idea, card.querySelector(".idea-copy-btn"));
  });

  return card;
}

async function copyIdeaToClipboard(idea, button) {
  const text = [
    idea.title,
    "",
    `Summary: ${idea.summary}`,
    `Why this fits the user: ${idea.whyFitsUser}`,
    `Why it could work: ${idea.whyItCouldWork}`,
    "How to start:",
    ...idea.howToStart.map((step) => `- ${step}`),
    `Monetization: ${idea.monetization}`,
    `Difficulty: ${idea.difficulty}`,
    `Startup Cost: ${idea.startupCost}`
  ].join("\n");

  try {
    await writeToClipboard(text);
    flashButton(button, "Copied!");
  } catch (error) {
    console.error(error);
    showError("Could not copy the idea to the clipboard. Please try again.");
  }
}

function flashButton(button, label) {
  const originalText = button.textContent;

  button.textContent = label;
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 1500);
}

function showLoading(loading) {
  isLoading = loading;
  elements.loadingSection.classList.toggle("d-none", !loading);
  elements.generateBtn.disabled = loading;
  elements.regenerateBtn.disabled = loading;

  if (loading) {
    elements.resultsSection.classList.add("d-none");
    elements.emptyState.classList.add("d-none");
  } else if (!elements.resultsGrid.children.length) {
    elements.emptyState.classList.remove("d-none");
  }
}

function showError(message) {
  elements.alertContainer.innerHTML = `
    <div class="alert alert-danger alert-dismissible fade show" role="alert">
      <strong>Unable to generate ideas.</strong> ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function clearError() {
  elements.alertContainer.innerHTML = "";
}

function resetFormAndResults() {
  elements.form.reset();
  clearError();
  clearFieldValidation();
  Object.keys(FIELD_CONFIG).forEach(clearGroupError);
  showLoading(false);

  elements.resultsGrid.innerHTML = "";
  elements.resultsSection.classList.add("d-none");
  elements.regenerateBtn.classList.add("d-none");
  elements.emptyState.classList.remove("d-none");
  elements.resultsModeBadge.textContent = "";
}

function setGroupError(groupName, message) {
  const group = groups[groupName];

  if (!group) {
    return;
  }

  group.fieldset?.classList.add("is-invalid");

  if (group.feedback) {
    group.feedback.textContent = message;
  }
}

function clearGroupError(groupName) {
  const group = groups[groupName];

  if (!group) {
    return;
  }

  group.fieldset?.classList.remove("is-invalid");

  if (group.feedback) {
    group.feedback.textContent = "";
  }
}

function clearFieldValidation() {
  document.querySelectorAll(".is-invalid").forEach((element) => {
    if (element.matches("fieldset, input")) {
      element.classList.remove("is-invalid");
    }
  });
}

function setResultsMode(mode) {
  elements.resultsModeBadge.textContent = mode;
}

function tryParseJson(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonBlock(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const firstBrace = text.indexOf("{");

  if (firstBrace === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(firstBrace, index + 1);
      }
    }
  }

  return "";
}

function normalizeIdea(idea, index) {
  const requiredFields = ["title", "summary", "whyFitsUser", "whyItCouldWork", "howToStart", "monetization", "difficulty", "startupCost"];

  requiredFields.forEach((field) => {
    if (!(field in idea)) {
      throw new Error(`Idea ${index + 1} is missing the "${field}" field.`);
    }
  });

  if (!Array.isArray(idea.howToStart)) {
    throw new Error(`Idea ${index + 1} has an invalid "howToStart" value.`);
  }

  const steps = idea.howToStart.map((step) => String(step).trim()).filter(Boolean).slice(0, 5);

  if (steps.length < 3) {
    throw new Error(`Idea ${index + 1} must include 3 to 5 starting steps.`);
  }

  const difficulty = String(idea.difficulty).trim();
  const startupCost = String(idea.startupCost).trim();

  if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
    throw new Error(`Idea ${index + 1} has an invalid difficulty value.`);
  }

  if (!["Low", "Medium", "High"].includes(startupCost)) {
    throw new Error(`Idea ${index + 1} has an invalid startup cost value.`);
  }

  return {
    title: String(idea.title).trim(),
    summary: String(idea.summary).trim(),
    whyFitsUser: String(idea.whyFitsUser).trim(),
    whyItCouldWork: String(idea.whyItCouldWork).trim(),
    howToStart: steps,
    monetization: String(idea.monetization).trim(),
    difficulty,
    startupCost
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function writeToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";

  document.body.appendChild(helper);
  helper.select();

  const copied = document.execCommand("copy");
  helper.remove();

  if (!copied) {
    throw new Error("Clipboard fallback failed.");
  }
}

function initializeUiEnhancements() {
  initializeCustomOptionBuilders();
  initializeExclusiveChoiceRules();
}

function getSingleValue(name) {
  return document.querySelector(`[name="${name}"]:checked`)?.value.trim() || "";
}

function getMultipleValues(name) {
  return Array.from(document.querySelectorAll(`[name="${name}"]:checked`)).map((input) => input.value.trim());
}

function initializeCustomOptionBuilders() {
  document.querySelectorAll(".custom-option-builder").forEach((builder) => {
    const toggleButton = builder.querySelector(".custom-option-toggle");
    const formWrap = builder.querySelector(".custom-option-form");
    const input = builder.querySelector(".custom-option-input");
    const addButton = builder.querySelector(".custom-option-add-btn");
    const groupName = builder.dataset.groupTarget;
    const actions = document.createElement("div");
    const resetButton = document.createElement("button");

    actions.className = "custom-option-actions";
    resetButton.type = "button";
    resetButton.className = "chip-action-btn custom-option-reset-btn";
    resetButton.textContent = "Reset Added";

    builder.insertBefore(actions, formWrap);
    actions.append(toggleButton, resetButton);

    toggleButton.addEventListener("click", () => {
      formWrap.classList.toggle("d-none");

      if (!formWrap.classList.contains("d-none")) {
        input.focus();
      }
    });

    addButton.addEventListener("click", () => {
      addCustomOption(groupName, input, formWrap);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomOption(groupName, input, formWrap);
      }
    });

    resetButton.addEventListener("click", () => {
      resetCustomOptions(groupName, input, formWrap);
    });
  });
}

function addCustomOption(groupName, input, formWrap) {
  const value = input.value.trim();

  if (!value) {
    return;
  }

  const existing = Array.from(document.querySelectorAll(`[name="${groupName}"]`))
    .some((option) => option.value.toLowerCase() === value.toLowerCase());

  if (existing) {
    input.value = "";
    formWrap.classList.add("d-none");
    return;
  }

  const fieldset = groups[groupName].fieldset;
  const chipGrid = fieldset.querySelector(".chip-grid");
  const inputType = FIELD_CONFIG[groupName].type === "single" ? "radio" : "checkbox";
  const id = `${groupName}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

  const optionInput = document.createElement("input");
  optionInput.className = "chip-check";
  optionInput.type = inputType;
  optionInput.id = id;
  optionInput.name = groupName;
  optionInput.value = value;
  optionInput.checked = true;
  optionInput.dataset.custom = "true";

  const optionLabel = document.createElement("label");
  optionLabel.className = "chip-label";
  optionLabel.htmlFor = id;
  optionLabel.textContent = value;
  optionLabel.dataset.custom = "true";

  chipGrid.append(optionInput, optionLabel);
  clearGroupError(groupName);
  input.value = "";
  formWrap.classList.add("d-none");
}

function resetCustomOptions(groupName, input, formWrap) {
  document.querySelectorAll(`[name="${groupName}"][data-custom="true"]`).forEach((optionInput) => {
    document.querySelector(`label[for="${optionInput.id}"][data-custom="true"]`)?.remove();
    optionInput.remove();
  });

  input.value = "";
  formWrap.classList.add("d-none");
  clearGroupError(groupName);
}

function initializeExclusiveChoiceRules() {
  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    const exclusiveValue = EXCLUSIVE_OPTIONS[target.name];

    if (!exclusiveValue) {
      return;
    }

    const inputs = Array.from(document.querySelectorAll(`input[name="${target.name}"]`));
    const exclusiveInput = inputs.find((input) => input.value === exclusiveValue);

    if (!exclusiveInput) {
      return;
    }

    if (target.value === exclusiveValue && target.checked) {
      inputs.forEach((input) => {
        if (input !== target) {
          input.checked = false;
        }
      });
      return;
    }

    if (target.checked && exclusiveInput.checked) {
      exclusiveInput.checked = false;
    }
  });
}

function getIdeaKey(idea) {
  return `${idea.title}::${idea.summary}`;
}

function loadFavoriteIdeas() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavoriteIdeas() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIdeas));
}

function isIdeaFavorite(idea) {
  return favoriteIdeas.some((favorite) => getIdeaKey(favorite) === getIdeaKey(idea));
}

function toggleFavoriteIdea(idea) {
  const key = getIdeaKey(idea);
  const index = favoriteIdeas.findIndex((favorite) => getIdeaKey(favorite) === key);

  if (index >= 0) {
    favoriteIdeas.splice(index, 1);
    saveFavoriteIdeas();
    renderFavoriteIdeas();
    return false;
  }

  favoriteIdeas.unshift(idea);
  saveFavoriteIdeas();
  renderFavoriteIdeas();
  return true;
}

function renderFavoriteIdeas() {
  elements.favoritesGrid.innerHTML = "";

  if (!favoriteIdeas.length) {
    elements.favoritesSection.classList.add("d-none");
    elements.favoritesCountBadge.textContent = "0 saved";
    return;
  }

  favoriteIdeas.forEach((idea, index) => {
    const column = document.createElement("div");
    column.className = "col-12";
    column.appendChild(createIdeaCard(idea, index, true));
    elements.favoritesGrid.appendChild(column);
  });

  elements.favoritesCountBadge.textContent = `${favoriteIdeas.length} saved`;
  elements.favoritesSection.classList.remove("d-none");
}

function updateFavoriteButtons(ideaKey, isFavorite) {
  document.querySelectorAll(`.idea-card[data-idea-key="${CSS.escape(ideaKey)}"] .idea-favorite-btn`).forEach((button) => {
    button.textContent = isFavorite ? "Remove Favorite" : "Add to Favorite";
  });
}
