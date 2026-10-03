const categories = {
  dad: "Dad",
  mom: "Mom",
  school: "School",
  helper: "Helper",
};

const calendar = document.querySelector("#calendar");
let activeFilter = null;

loadCalendar();

async function loadCalendar() {
  try {
    const response = await fetch("./data/calendar.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Calendar data returned ${response.status}`);

    const data = await response.json();
    data.months.forEach((month) => calendar.append(renderMonth(month)));
    bindFilters();
  } catch (error) {
    console.error(error);
    calendar.innerHTML = '<p class="calendar-error">The calendar could not be loaded. Please try again.</p>';
  }
}

function renderMonth(month) {
  const section = document.createElement("section");
  section.className = "month";
  section.setAttribute("aria-labelledby", `${month.name.toLowerCase()}-title`);

  const title = document.createElement("h2");
  title.className = "month-title";
  title.id = `${month.name.toLowerCase()}-title`;
  title.textContent = month.name;
  section.append(title);

  const weekdays = document.createElement("div");
  weekdays.className = "weekday-grid";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
    const label = document.createElement("div");
    label.className = "weekday";
    label.textContent = day;
    weekdays.append(label);
  });
  section.append(weekdays);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  grid.setAttribute("role", "grid");

  const firstDay = new Date(month.year, month.month, 1).getDay();
  const totalDays = new Date(month.year, month.month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDay + totalDays) / 7) * 7;

  for (let cell = 0; cell < cellCount; cell += 1) {
    const day = cell - firstDay + 1;
    const dayCell = document.createElement("div");
    dayCell.className = `day${day < 1 || day > totalDays ? " empty" : ""}`;
    dayCell.setAttribute("role", "gridcell");

    if (day >= 1 && day <= totalDays) {
      dayCell.setAttribute("aria-label", `${month.name} ${day}, ${month.year}`);

      const date = document.createElement("span");
      date.className = "date-number";
      date.textContent = day;
      dayCell.append(date);

      const events = document.createElement("div");
      events.className = "events";
      month.events
        .filter((event) => day >= eventStart(event) && day <= eventEnd(event))
        .forEach((event) => {
          const item = document.createElement("div");
          item.className = `event event-${event.category}`;
          item.dataset.category = event.category;
          item.textContent = event.label;
          item.title = `${categories[event.category]}: ${event.label}`;
          events.append(item);
        });
      dayCell.append(events);

      if (month.travel[String(day)]) {
        const travel = document.createElement("span");
        travel.className = `travel ${month.travel[String(day)]}`;
        travel.textContent = "✈";
        travel.setAttribute(
          "aria-label",
          month.travel[String(day)] === "depart" ? "Departure" : "Arrival",
        );
        dayCell.append(travel);
      }

      if (month.due === day) {
        const ring = document.createElement("span");
        ring.className = "due-ring";
        ring.setAttribute("aria-hidden", "true");
        dayCell.append(ring);
      }
    } else {
      dayCell.setAttribute("aria-hidden", "true");
    }

    grid.append(dayCell);
  }

  section.append(grid);
  return section;
}

function eventStart(event) {
  return event.day ?? event.startDay;
}

function eventEnd(event) {
  return event.day ?? event.endDay;
}

function bindFilters() {
  document.querySelectorAll(".legend-item").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;
      activeFilter = activeFilter === selected ? null : selected;

      document.querySelectorAll(".legend-item").forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.filter === activeFilter));
      });

      document.querySelectorAll(".event").forEach((event) => {
        event.classList.toggle(
          "is-muted",
          activeFilter !== null && event.dataset.category !== activeFilter,
        );
      });
    });
  });
}
