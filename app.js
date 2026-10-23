(() => {
  "use strict";

  const STORAGE_KEY = "forja-rpg-character-v1";
  const TOTAL_POINTS = 27;
  const MIN_ATTRIBUTE = 8;
  const MAX_ATTRIBUTE = 18;
  const attributes = [
    { key: "strength", name: "Fuerza", abbr: "FUE", icon: "⚔" },
    { key: "dexterity", name: "Destreza", abbr: "DES", icon: "➶" },
    { key: "constitution", name: "Constitución", abbr: "CON", icon: "◆" },
    { key: "intelligence", name: "Inteligencia", abbr: "INT", icon: "✦" },
    { key: "wisdom", name: "Sabiduría", abbr: "SAB", icon: "◉" },
    { key: "charisma", name: "Carisma", abbr: "CAR", icon: "✧" }
  ];

  const defaultState = () => ({
    identity: { name: "", class: "Guerrero/a", race: "Humano", background: "Forastero", level: 1, story: "" },
    portrait: "assets/portraits/guardian.svg",
    vitals: { hitPoints: 12, armor: 12, speed: 9, gold: 25 },
    attributes: Object.fromEntries(attributes.map(attribute => [attribute.key, 8])),
    skills: [
      { name: "Golpe poderoso", description: "Ataque cuerpo a cuerpo · +2 al daño" },
      { name: "Instinto aventurero", description: "Ventaja al detectar peligros cercanos" },
      { name: "Voluntad de hierro", description: "+1 contra efectos de miedo" }
    ],
    inventory: [
      { name: "Espada larga", quantity: 1, weight: 1.4 },
      { name: "Mochila de viaje", quantity: 1, weight: 2 },
      { name: "Poción de curación", quantity: 2, weight: 0.3 }
    ],
    notes: ""
  });

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const form = $("#characterForm");
  const attributesGrid = $("#attributesGrid");
  const skillsList = $("#skillsList");
  const inventoryList = $("#inventoryList");
  const portraitPreview = $("#portraitPreview");
  const toast = $("#toast");
  let portraitValue = "assets/portraits/guardian.svg";
  let toastTimer;

  function modifier(value) {
    return Math.floor((Number(value) - 10) / 2);
  }

  function signed(value) {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  function usedPoints() {
    return attributes.reduce((sum, attribute) => {
      const input = $(`[data-attribute="${attribute.key}"]`);
      return sum + Math.max(0, Number(input?.value || MIN_ATTRIBUTE) - MIN_ATTRIBUTE);
    }, 0);
  }

  function renderAttributes(values = {}) {
    attributesGrid.innerHTML = attributes.map(attribute => {
      const value = Number(values[attribute.key] ?? MIN_ATTRIBUTE);
      return `
        <article class="attribute-card">
          <span class="attribute-icon" aria-hidden="true">${attribute.icon}</span>
          <h3 class="attribute-name">${attribute.name}</h3>
          <span class="attribute-abbr">${attribute.abbr}</span>
          <div class="attribute-controls">
            <button type="button" data-change="-1" data-key="${attribute.key}" aria-label="Reducir ${attribute.name}">−</button>
            <output class="attribute-value" data-attribute="${attribute.key}" aria-label="${attribute.name}: ${value}">${value}</output>
            <button type="button" data-change="1" data-key="${attribute.key}" aria-label="Aumentar ${attribute.name}">+</button>
          </div>
          <span class="attribute-mod" data-modifier="${attribute.key}">${signed(modifier(value))} modificador</span>
        </article>`;
    }).join("");
    updateAttributeUI();
  }

  function updateAttributeUI() {
    const remaining = TOTAL_POINTS - usedPoints();
    $("#pointsAvailable").textContent = remaining;
    attributes.forEach(attribute => {
      const output = $(`[data-attribute="${attribute.key}"]`);
      const value = Number(output.value);
      output.textContent = value;
      $(`[data-modifier="${attribute.key}"]`).textContent = `${signed(modifier(value))} modificador`;
      $$(`[data-key="${attribute.key}"]`).forEach(button => {
        const direction = Number(button.dataset.change);
        button.disabled = direction > 0 ? remaining <= 0 || value >= MAX_ATTRIBUTE : value <= MIN_ATTRIBUTE;
      });
    });
    const dexterity = Number($("[data-attribute='dexterity']")?.value || 8);
    $("#initiative").textContent = signed(modifier(dexterity));
    updateDerivedStats();
  }

  function createSkill(skill = { name: "Nueva habilidad", description: "Describe su efecto" }) {
    const card = document.createElement("div");
    card.className = "skill-card";
    card.innerHTML = `
      <span class="skill-rank" aria-hidden="true">✦</span>
      <div class="skill-fields">
        <input class="skill-name" type="text" maxlength="50" value="${escapeAttribute(skill.name)}" aria-label="Nombre de habilidad">
        <input class="skill-description" type="text" maxlength="120" value="${escapeAttribute(skill.description)}" aria-label="Descripción de habilidad">
      </div>
      <button class="remove-button" type="button" aria-label="Eliminar habilidad">×</button>`;
    skillsList.append(card);
  }

  function createInventoryItem(item = { name: "Nuevo objeto", quantity: 1, weight: 0 }) {
    const row = document.createElement("div");
    row.className = "inventory-item";
    row.innerHTML = `
      <input class="item-name" type="text" maxlength="60" value="${escapeAttribute(item.name)}" aria-label="Nombre del objeto">
      <input class="item-quantity" type="number" min="0" max="999" value="${Number(item.quantity) || 0}" aria-label="Cantidad">
      <label class="weight-field"><input class="item-weight" type="number" min="0" max="999" step="0.1" value="${Number(item.weight) || 0}" aria-label="Peso unitario"><span>kg</span></label>
      <button class="remove-button" type="button" aria-label="Eliminar objeto">×</button>`;
    inventoryList.append(row);
    updateWeight();
  }

  function escapeAttribute(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function collectState() {
    return {
      identity: {
        name: $("#characterName").value.trim(),
        class: $("#characterClass").value,
        race: $("#characterRace").value,
        background: $("#characterBackground").value,
        level: Number($("#characterLevel").value) || 1,
        story: $("#characterStory").value
      },
      portrait: portraitValue,
      vitals: {
        hitPoints: Number($("#hitPoints").value) || 1,
        armor: Number($("#armor").value) || 0,
        speed: Number($("#speed").value) || 0,
        gold: Number($("#gold").value) || 0
      },
      attributes: Object.fromEntries(attributes.map(attribute => [attribute.key, Number($(`[data-attribute="${attribute.key}"]`).value)])),
      skills: $$(".skill-card").map(card => ({
        name: card.querySelector(".skill-name").value,
        description: card.querySelector(".skill-description").value
      })),
      inventory: $$(".inventory-item").map(row => ({
        name: row.querySelector(".item-name").value,
        quantity: Number(row.querySelector(".item-quantity").value) || 0,
        weight: Number(row.querySelector(".item-weight").value) || 0
      })),
      notes: $("#campaignNotes").value
    };
  }

  function populate(state) {
    const safe = { ...defaultState(), ...state };
    const identity = { ...defaultState().identity, ...safe.identity };
    const vitals = { ...defaultState().vitals, ...safe.vitals };
    $("#characterName").value = identity.name;
    setSelectValue("#characterClass", identity.class);
    setSelectValue("#characterRace", identity.race);
    setSelectValue("#characterBackground", identity.background);
    $("#characterLevel").value = identity.level;
    $("#characterStory").value = identity.story;
    $("#hitPoints").value = vitals.hitPoints;
    $("#armor").value = vitals.armor;
    $("#speed").value = vitals.speed;
    $("#gold").value = vitals.gold;
    $("#campaignNotes").value = safe.notes || "";
    setPortrait(safe.portrait || defaultState().portrait);
    renderAttributes({ ...defaultState().attributes, ...safe.attributes });
    skillsList.innerHTML = "";
    (Array.isArray(safe.skills) ? safe.skills : []).forEach(createSkill);
    inventoryList.innerHTML = "";
    (Array.isArray(safe.inventory) ? safe.inventory : []).forEach(createInventoryItem);
    updateStoryCount();
    updateDerivedStats();
    updateWeight();
  }

  function setSelectValue(selector, value) {
    const select = $(selector);
    if ([...select.options].some(option => option.value === value)) select.value = value;
  }

  function setPortrait(source) {
    portraitValue = source;
    portraitPreview.src = source;
    $$(".preset").forEach(button => button.classList.toggle("active", button.dataset.portrait === source));
  }

  function updateDerivedStats() {
    const level = Math.max(1, Math.min(20, Number($("#characterLevel").value) || 1));
    const proficiency = 2 + Math.floor((level - 1) / 4);
    const strength = Number($("[data-attribute='strength']")?.value || 8);
    const dexterity = Number($("[data-attribute='dexterity']")?.value || 8);
    const wisdom = Number($("[data-attribute='wisdom']")?.value || 8);
    const hitPoints = Math.max(1, Number($("#hitPoints").value) || 1);
    const armor = Math.max(0, Number($("#armor").value) || 0);
    const gold = Math.max(0, Number($("#gold").value) || 0);
    const name = $("#characterName").value.trim() || "Héroe sin nombre";
    const characterClass = $("#characterClass").value;
    const race = $("#characterRace").value;

    $("#proficiency").textContent = signed(proficiency);
    $("#proficiencyCombat").textContent = signed(proficiency);
    $("#passivePerception").textContent = 10 + modifier(wisdom);
    $("#meleeAttack").textContent = `${signed(proficiency + modifier(strength))} / daño ${signed(modifier(strength))}`;
    $("#rangedAttack").textContent = `${signed(proficiency + modifier(dexterity))} / daño ${signed(modifier(dexterity))}`;
    $("#displayName").textContent = name;
    $("#displayMeta").textContent = `Nivel ${level} · ${race} · ${characterClass} — estadísticas, equipo e historia de un vistazo.`;
    $("#cardName").textContent = name;
    $("#cardMeta").textContent = `${race} · ${characterClass}`.toUpperCase();
    $("#levelBadge").textContent = level;
    $("#cardHp").textContent = hitPoints;
    $("#cardArmor").textContent = armor;
    $("#cardInitiative").textContent = signed(modifier(dexterity));
    $("#hpMax").textContent = hitPoints;
    $("#hpBar").style.width = "100%";
    $("#goldPreview").textContent = gold;

    const xpTarget = level >= 20 ? 0 : level * 300;
    $("#xpCurrent").textContent = xpTarget.toLocaleString("es-ES");
    $("#xpTarget").textContent = xpTarget.toLocaleString("es-ES");
    $("#xpBar").style.width = level >= 20 ? "100%" : "100%";
    $("#levelHint").textContent = level >= 20 ? "Leyenda de nivel máximo" : `Nivel ${level + 1} disponible`;
    $("#levelUp").disabled = level >= 20;
    $("#levelUp").textContent = level >= 20 ? "✦ Nivel máximo" : `✣ Subir a nivel ${level + 1}`;
  }

  function updateStoryCount() {
    $("#storyCount").textContent = $("#characterStory").value.length;
  }

  function updateWeight() {
    const weight = $$(".inventory-item").reduce((sum, row) => {
      return sum + (Number(row.querySelector(".item-quantity").value) || 0) * (Number(row.querySelector(".item-weight").value) || 0);
    }, 0);
    $("#totalWeight").textContent = weight.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  }

  function showToast(message, icon = "✓") {
    clearTimeout(toastTimer);
    $("#toastMessage").textContent = message;
    $(".toast-icon").textContent = icon;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      showToast("Ficha guardada en este dispositivo");
    } catch (error) {
      showToast("No se pudo guardar la ficha", "!");
    }
  }

  function queueAutoSave() {
    clearTimeout(form.autoSaveTimer);
    form.autoSaveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState())); } catch (_) { /* Storage may be unavailable. */ }
    }, 700);
  }

  function exportState() {
    const state = collectState();
    const safeName = (state.identity.name || "personaje-rpg").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName || "personaje-rpg"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Ficha exportada como JSON", "↓");
  }

  attributesGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-change]");
    if (!button) return;
    const output = $(`[data-attribute="${button.dataset.key}"]`);
    const next = Number(output.value) + Number(button.dataset.change);
    if (next < MIN_ATTRIBUTE || next > MAX_ATTRIBUTE) return;
    if (Number(button.dataset.change) > 0 && usedPoints() >= TOTAL_POINTS) return;
    output.value = next;
    output.textContent = next;
    updateAttributeUI();
    queueAutoSave();
  });

  [$("#addSkill"), $("#addSkillBottom")].forEach(button => button.addEventListener("click", () => {
    createSkill();
    skillsList.lastElementChild.querySelector(".skill-name").select();
    queueAutoSave();
  }));
  $("#addItem").addEventListener("click", () => {
    createInventoryItem();
    inventoryList.lastElementChild.querySelector(".item-name").select();
    queueAutoSave();
  });
  skillsList.addEventListener("click", event => {
    if (event.target.closest(".remove-button")) {
      event.target.closest(".skill-card").remove();
      queueAutoSave();
    }
  });
  inventoryList.addEventListener("click", event => {
    if (event.target.closest(".remove-button")) {
      event.target.closest(".inventory-item").remove();
      updateWeight();
      queueAutoSave();
    }
  });
  inventoryList.addEventListener("input", updateWeight);
  $("#characterStory").addEventListener("input", updateStoryCount);
  $("#characterLevel").addEventListener("input", updateDerivedStats);
  $("#levelUp").addEventListener("click", () => {
    const levelInput = $("#characterLevel");
    const level = Math.max(1, Math.min(20, Number(levelInput.value) || 1));
    if (level >= 20) return;
    levelInput.value = level + 1;
    updateDerivedStats();
    queueAutoSave();
    showToast(`Has alcanzado el nivel ${level + 1}`, "✦");
  });

  $$(".preset").forEach(button => button.addEventListener("click", () => {
    setPortrait(button.dataset.portrait);
    queueAutoSave();
  }));
  $("#portraitUpload").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("El archivo debe ser una imagen", "!");
    if (file.size > 2_500_000) return showToast("La imagen debe pesar menos de 2,5 MB", "!");
    const reader = new FileReader();
    reader.onload = () => {
      setPortrait(reader.result);
      queueAutoSave();
      showToast("Retrato personalizado añadido");
    };
    reader.readAsDataURL(file);
  });

  $("#rollDice").addEventListener("click", () => {
    const button = $("#rollDice");
    const result = Math.floor(Math.random() * 20) + 1;
    const message = result === 20 ? "20 · ¡Crítico!" : result === 1 ? "1 · Pifia" : `${result} en el dado`;
    $("#diceResult").textContent = message;
    button.textContent = result;
    button.classList.add("rolled");
    showToast(message, "◇");
    setTimeout(() => { button.textContent = "d20"; button.classList.remove("rolled"); }, 1600);
  });

  $("#saveCharacter").addEventListener("click", saveState);
  $("#exportCharacter").addEventListener("click", exportState);
  $("#printCharacter").addEventListener("click", () => window.print());
  $("#newCharacter").addEventListener("click", () => $("#confirmDialog").showModal());
  $("#cancelNew").addEventListener("click", () => $("#confirmDialog").close());
  $("#confirmNew").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    populate(defaultState());
    $("#confirmDialog").close();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Nueva ficha preparada", "✦");
  });
  $("#confirmDialog").addEventListener("click", event => {
    if (event.target === $("#confirmDialog")) $("#confirmDialog").close();
  });

  form.addEventListener("input", event => {
    if (event.target.matches("input, textarea, select")) {
      updateDerivedStats();
      queueAutoSave();
    }
  });
  form.addEventListener("change", event => {
    if (event.target.matches("select")) updateDerivedStats();
  });

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { localStorage.removeItem(STORAGE_KEY); }
  populate(saved || defaultState());
})();
