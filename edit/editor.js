const categoryNames = {
  dad: "Dad",
  mom: "Mom",
  school: "School",
  helper: "Helper",
};

if (window.location.hostname.endsWith("github.io")) {
  window.location.replace("https://family-calendar-q4-2026.vercel.app/edit");
}

const elements = {
  unlockPanel: document.querySelector("#unlock-panel"),
  unlockForm: document.querySelector("#unlock-form"),
  unlockMessage: document.querySelector("#unlock-message"),
  pin: document.querySelector("#pin"),
  workspace: document.querySelector("#workspace"),
  add: document.querySelector("#add-event"),
  undo: document.querySelector("#undo"),
  save: document.querySelector("#save"),
  syncStatus: document.querySelector("#sync-status"),
  eventList: document.querySelector("#event-list"),
  dialog: document.querySelector("#event-dialog"),
  eventForm: document.querySelector("#event-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  deleteEvent: document.querySelector("#delete-event"),
  eventMessage: document.querySelector("#event-message"),
  eventId: document.querySelector("#event-id"),
  eventLabel: document.querySelector("#event-label"),
  eventCategory: document.querySelector("#event-category"),
  eventStart: document.querySelector("#event-start"),
  eventEnd: document.querySelector("#event-end"),
};

let pin = sessionStorage.getItem("family-calendar-pin") || "";
let calendar = null;
let revision = null;
let undoStack = [];
let dirty = false;

elements.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  pin = elements.pin.value.trim();
  await unlock();
});

elements.add.addEventListener("click", () => openEventDialog());
elements.undo.addEventListener("click", undo);
elements.save.addEventListener("click", save);
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.eventForm.addEventListener("submit", applyEvent);
elements.deleteEvent.addEventListener("click", deleteEvent);
window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

if (/^\d{6}$/.test(pin)) {
  elements.pin.value = pin;
  unlock();
}

async function unlock() {
  setUnlockMessage("Opening...");
  setUnlockBusy(true);

  try {
    const response = await fetch("/api/calendar", {
      headers: { "x-family-pin": pin },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not open the editor");

    calendar = result.calendar;
    revision = result.sha;
    undoStack = [];
    dirty = false;
    sessionStorage.setItem("family-calendar-pin", pin);
    elements.unlockPanel.hidden = true;
    elements.workspace.hidden = false;
    render();
    setSyncStatus("Up to date", "saved");
  } catch (error) {
    sessionStorage.removeItem("family-calendar-pin");
    setUnlockMessage(error.message);
    elements.pin.select();
  } finally {
    setUnlockBusy(false);
  }
}

function render() {
  elements.eventList.replaceChildren();

  calendar.months.forEach((month) => {
    const section = document.createElement("section");
    section.className = "event-month";

    const title = document.createElement("h2");
    title.textContent = month.name;
    section.append(title);

    const events = [...month.events].sort((a, b) => (
      eventStart(a) - eventStart(b) || a.label.localeCompare(b.label)
    ));

    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-month";
      empty.textContent = "No events";
      section.append(empty);
    }

    events.forEach((event) => section.append(eventRow(month, event)));
    elements.eventList.append(section);
  });

  elements.undo.disabled = undoStack.length === 0;
  elements.save.disabled = !dirty;
}

function eventRow(month, event) {
  const row = document.createElement("button");
  row.className = "event-row";
  row.type = "button";
  row.addEventListener("click", () => openEventDialog(month, event));

  const marker = document.createElement("span");
  marker.className = `event-marker ${event.category}`;
  marker.setAttribute("aria-hidden", "true");

  const date = document.createElement("span");
  date.className = "event-date";
  date.textContent = formatRange(month, event);

  const title = document.createElement("span");
  title.className = "event-title";
  title.textContent = event.label;

  const owner = document.createElement("span");
  owner.className = "event-owner";
  owner.textContent = categoryNames[event.category];

  const chevron = document.createElement("span");
  chevron.className = "event-chevron";
  chevron.textContent = "›";
  chevron.setAttribute("aria-hidden", "true");

  row.append(marker, date, title, owner, chevron);
  row.setAttribute("aria-label", `Edit ${event.label}, ${date.textContent}`);
  return row;
}

function openEventDialog(month = null, event = null) {
  elements.eventForm.reset();
  elements.eventMessage.textContent = "";
  elements.eventId.value = event?.id || "";
  elements.dialogTitle.textContent = event ? "Edit event" : "Add event";
  elements.deleteEvent.hidden = !event;

  if (event && month) {
    elements.eventLabel.value = event.label;
    elements.eventCategory.value = event.category;
    elements.eventStart.value = toDateValue(month, eventStart(event));
    elements.eventEnd.value = toDateValue(month, eventEnd(event));
  } else {
    const firstMonth = calendar.months[0];
    const today = clampToday(firstMonth);
    elements.eventStart.value = today;
    elements.eventEnd.value = today;
  }

  elements.dialog.showModal();
  elements.eventLabel.focus();
}

function applyEvent(event) {
  event.preventDefault();
  const start = parseDate(elements.eventStart.value);
  const end = parseDate(elements.eventEnd.value);

  if (!start || !end || start.year !== end.year || start.month !== end.month) {
    return setEventMessage("An event must start and end in the same month.");
  }
  if (end.day < start.day) {
    return setEventMessage("The end date must be on or after the start date.");
  }

  const targetMonth = calendar.months.find((month) => (
    month.year === start.year && month.month === start.month
  ));
  if (!targetMonth) return setEventMessage("Choose a date shown on this calendar.");

  rememberUndo();
  const existing = findEvent(elements.eventId.value);
  const wasDue = existing ? existing.month.due === eventStart(existing.event) : false;
  if (existing) {
    existing.month.events = existing.month.events.filter((item) => item.id !== existing.event.id);
  }

  const updatedEvent = {
    id: existing?.event.id || createEventId(elements.eventCategory.value, elements.eventLabel.value, elements.eventStart.value),
    startDay: start.day,
    endDay: end.day,
    category: elements.eventCategory.value,
    label: elements.eventLabel.value.trim(),
  };
  targetMonth.events.push(updatedEvent);

  if (wasDue) {
    calendar.months.forEach((month) => delete month.due);
    targetMonth.due = start.day;
  }

  markDirty();
  elements.dialog.close();
  render();
}

function deleteEvent() {
  const existing = findEvent(elements.eventId.value);
  if (!existing) return;

  rememberUndo();
  existing.month.events = existing.month.events.filter((event) => event.id !== existing.event.id);
  if (existing.month.due === eventStart(existing.event)) delete existing.month.due;
  markDirty();
  elements.dialog.close();
  render();
}

function undo() {
  const previous = undoStack.pop();
  if (!previous) return;

  calendar = previous;
  dirty = true;
  render();
  setSyncStatus("Undo applied. Save to publish.", "dirty");
}

async function save() {
  elements.save.disabled = true;
  elements.add.disabled = true;
  setSyncStatus("Saving to the family calendar...", "dirty");

  try {
    const response = await fetch("/api/calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-family-pin": pin,
      },
      body: JSON.stringify({ calendar, expectedSha: revision }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save the calendar");

    revision = result.sha;
    dirty = false;
    setSyncStatus("Saved. The public calendar will refresh shortly.", "saved");
  } catch (error) {
    setSyncStatus(error.message, "dirty");
  } finally {
    elements.add.disabled = false;
    render();
  }
}

function findEvent(id) {
  if (!id) return null;
  for (const month of calendar.months) {
    const event = month.events.find((item) => item.id === id);
    if (event) return { month, event };
  }
  return null;
}

function rememberUndo() {
  undoStack.push(structuredClone(calendar));
  if (undoStack.length > 20) undoStack.shift();
}

function markDirty() {
  dirty = true;
  setSyncStatus("Changes not saved", "dirty");
}

function eventStart(event) {
  return event.day ?? event.startDay;
}

function eventEnd(event) {
  return event.day ?? event.endDay;
}

function formatRange(month, event) {
  const start = eventStart(event);
  const end = eventEnd(event);
  return start === end ? `${month.name.slice(0, 3)} ${start}` : `${month.name.slice(0, 3)} ${start}-${end}`;
}

function toDateValue(month, day) {
  return `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function clampToday(firstMonth) {
  const today = new Date();
  const candidate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return candidate >= "2026-10-01" && candidate <= "2026-12-31"
    ? candidate
    : toDateValue(firstMonth, 1);
}

function createEventId(category, label, date) {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "event";
  return `${category}-${slug}-${date}-${crypto.randomUUID().slice(0, 8)}`;
}

function setUnlockMessage(message) {
  elements.unlockMessage.textContent = message;
}

function setUnlockBusy(busy) {
  elements.pin.disabled = busy;
  elements.unlockForm.querySelector("button").disabled = busy;
}

function setEventMessage(message) {
  elements.eventMessage.textContent = message;
}

function setSyncStatus(message, state) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.className = `sync-status${state ? ` is-${state}` : ""}`;
}
