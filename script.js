(() => {
  const $ = selector => document.querySelector(selector);
  const form = $("#form");
  const metric = $("#metric");
  const imperial = $("#imperial");
  const unitButtons = [...document.querySelectorAll(".unit")];
  const historyKey = "aphrodite-bmi-history";
  let unit = "metric";
  let history = [];

  const info = {
    under: {
      label: "Below healthy range",
      description: "Your BMI is below the commonly used healthy range for adults. BMI alone cannot explain why; consider discussing your individual needs with a qualified health professional.",
      advice: "Focus on regular, nourishing meals and gentle, enjoyable movement."
    },
    healthy: {
      label: "Healthy range",
      description: "Your BMI is within the commonly used healthy range for adults. Keep building balanced habits that work for you.",
      advice: "Aim for enjoyable movement, balanced meals, hydration, and consistent sleep."
    },
    over: {
      label: "Above healthy range",
      description: "Your BMI is above the commonly used healthy range for adults. It is only one screening measure and does not tell the whole story about your health.",
      advice: "Choose realistic habits you can maintain and avoid judging health from one number alone."
    },
    obese: {
      label: "Higher BMI range",
      description: "Your BMI falls in a higher adult category. BMI is not a diagnosis; a clinician can help interpret it alongside your overall health.",
      advice: "Consider speaking with a qualified health professional for individual guidance."
    },
    ageSpecific: {
      label: "Age-specific interpretation needed",
      description: "Your BMI is shown, but adult BMI categories are not intended for people under 20. BMI for children and teens is interpreted using age- and sex-specific growth charts.",
      advice: "For an age-appropriate interpretation, speak with a qualified health professional."
    }
  };

  /**
   * Returns the standard adult BMI category for an already-calculated BMI.
   * @param {number} bmi A finite BMI value.
   * @returns {"under"|"healthy"|"over"|"obese"} Adult category key.
   */
  function category(bmi) {
    if (bmi < 18.5) return "under";
    if (bmi < 25) return "healthy";
    if (bmi < 30) return "over";
    return "obese";
  }

  /**
   * Loads and validates recent calculations from browser storage.
   * Invalid or unavailable saved data is reported and treated as empty history.
   * @returns {Array<{bmi: number|string, cat: string, age?: number|null, date: string}>} Valid recent entries.
   */
  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (!Array.isArray(saved)) throw new Error("Saved history is not a list.");
      return saved.filter(item => {
        if (
          !item ||
          (typeof item.bmi !== "number" && typeof item.bmi !== "string") ||
          (typeof item.bmi === "string" && item.bmi.trim() === "") ||
          !Object.prototype.hasOwnProperty.call(info, item.cat) && item.cat !== "ageSpecific" ||
          typeof item.date !== "string"
        ) {
          return false;
        }

        const bmi = Number(item.bmi);
        return Number.isFinite(bmi) && bmi > 0;
      }).slice(0, 8);
    } catch {
      $("#storage-status").textContent = "Saved history could not be read. You can still calculate your BMI during this visit.";
      return [];
    }
  }

  /**
   * Renders the current history state and updates its count and clear action.
   * @returns {void}
   */
  function renderHistory() {
    const list = $("#history-list");
    $("#history-count").textContent = `${history.length} saved`;
    $("#clear").disabled = history.length === 0;
    if (!history.length) {
      list.innerHTML = '<p class="empty">Your calculations will appear here after you calculate your BMI.</p>';
      return;
    }

    list.innerHTML = history.map(item => {
      const details = info[item.cat] || info.ageSpecific;
      const date = new Date(item.date);
      const dateText = Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
      const ageText = Number.isInteger(item.age) ? ` · Age ${item.age}` : "";
      return `<div class="history-item"><div><strong>${details.label}</strong><small>${dateText}${ageText}</small></div><div class="score-small"><strong>${Number(item.bmi).toFixed(1)}</strong><small>BMI</small></div></div>`;
    }).join("");
  }

  /**
   * Updates validation messaging, invalid input attributes, and input focus.
   * @param {string} message User-facing validation message.
   * @param {string[]} [invalidFields=[]] IDs of fields that failed validation.
   * @returns {void}
   */
  function setError(message, invalidFields = []) {
    document.querySelectorAll("#form input").forEach(input => input.removeAttribute("aria-invalid"));
    invalidFields.forEach(id => $(`#${id}`).setAttribute("aria-invalid", "true"));
    $("#error").textContent = message;
    if (invalidFields.length) $(`#${invalidFields[0]}`).focus();
  }

  /**
   * Persists the current history, reporting storage failures without losing the result.
   * @returns {void}
   */
  function saveHistory() {
    try {
      localStorage.setItem(historyKey, JSON.stringify(history));
      $("#storage-status").textContent = "";
    } catch {
      $("#storage-status").textContent = "This result is shown, but browser storage is unavailable so it was not saved.";
    }
  }

  /**
   * Validates the selected units, calculates BMI, and updates the result and history.
   * @param {SubmitEvent} [event] Form submit event, when invoked by the form.
   * @returns {void}
   */
  function calculate(event) {
    if (event) event.preventDefault();
    setError("");

    let height;
    let weight;
    if (unit === "metric") {
      const heightCm = Number($("#height").value);
      weight = Number($("#weight").value);
      if (!$("#height").value || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) {
        setError("Enter a height between 50 and 260 cm.", ["height"]);
        return;
      }
      if (!$("#weight").value || !Number.isFinite(weight) || weight < 10 || weight > 500) {
        setError("Enter a weight between 10 and 500 kg.", ["weight"]);
        return;
      }
      height = heightCm / 100;
    } else {
      const feet = Number($("#feet").value);
      const inches = $("#inches").value === "" ? 0 : Number($("#inches").value);
      const pounds = Number($("#pounds").value);
      if (!$("#feet").value || !Number.isInteger(feet) || feet < 1 || feet > 8) {
        setError("Enter a height between 1 and 8 feet.", ["feet"]);
        return;
      }
      if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
        setError("Enter inches from 0 up to, but not including, 12.", ["inches"]);
        return;
      }
      if (!$("#pounds").value || !Number.isFinite(pounds) || pounds < 22 || pounds > 1100) {
        setError("Enter a weight between 22 and 1,100 lb.", ["pounds"]);
        return;
      }
      height = (feet * 12 + inches) * 0.0254;
      weight = pounds * 0.45359237;
    }

    const ageValue = $("#age").value;
    const age = ageValue === "" ? null : Number(ageValue);
    if (age !== null && (!Number.isInteger(age) || age < 2 || age > 120)) {
      setError("Enter an age from 2 to 120, or leave it blank.", ["age"]);
      return;
    }

    const bmi = weight / (height * height);
    const cat = age !== null && age < 20 ? "ageSpecific" : category(bmi);
    const details = info[cat];
    $("#value").textContent = bmi.toFixed(1);
    $("#category").textContent = details.label;
    $("#category").className = `category ${cat}`;
    $("#description").textContent = details.description;
    $("#guidance").textContent = details.advice;

    const marker = $("#marker");
    if (cat === "ageSpecific") {
      marker.hidden = true;
    } else {
      marker.style.left = `${Math.max(0, Math.min(100, ((bmi - 10) / 30) * 100))}%`;
      marker.hidden = false;
    }

    history.unshift({ bmi: bmi.toFixed(1), cat, age, date: new Date().toISOString() });
    history = history.slice(0, 8);
    saveHistory();
    renderHistory();
    if (window.matchMedia("(max-width: 760px)").matches) {
      const resultTitle = $("#result-title");
      resultTitle.focus({ preventScroll: true });
      $("#result").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    }
  }

  unitButtons.forEach(button => button.addEventListener("click", () => {
    unit = button.dataset.unit;
    metric.hidden = unit !== "metric";
    imperial.hidden = unit !== "imperial";
    unitButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    setError("");
  }));

  form.addEventListener("submit", calculate);
  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    $("#error").textContent = "";
  });

  $("#reset-button").addEventListener("click", () => {
    form.reset();
    $("#height").value = 170;
    $("#weight").value = 65;
    unit = "metric";
    metric.hidden = false;
    imperial.hidden = true;
    unitButtons.forEach(button => {
      const active = button.dataset.unit === "metric";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    setError("");
    $("#value").textContent = "—";
    $("#category").textContent = "Ready to calculate";
    $("#category").className = "category";
    $("#description").textContent = "Enter your details and calculate your BMI to see a general adult category and wellness guidance.";
    $("#guidance").textContent = "Start with small, sustainable habits that fit your life.";
    $("#marker").hidden = true;
  });

  $("#clear").addEventListener("click", () => {
    history = [];
    try {
      localStorage.removeItem(historyKey);
      $("#storage-status").textContent = "";
    } catch {
      $("#storage-status").textContent = "History was cleared for this visit, but browser storage could not be updated.";
    }
    renderHistory();
  });

  history = readHistory();
  renderHistory();
  $("#marker").hidden = true;
})();
