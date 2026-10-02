const categories = {
  dad: "Dad",
  mom: "Mom",
  school: "School",
  helper: "Helper",
};

const months = [
  {
    name: "October",
    year: 2026,
    month: 9,
    events: [
      ...range(1, 3, "dad", "Dubai"),
      { day: 6, category: "mom", label: "Week 28 appointment" },
      ...range(15, 31, "dad", "Argentina"),
      { day: 25, category: "school", label: "Day off" },
      ...range(26, 29, "school", "Grandparents week"),
      ...range(27, 31, "helper", "Helper trip"),
    ],
    travel: {
      1: "depart",
      3: "arrive",
      15: "depart",
      27: "depart",
      31: "arrive",
    },
  },
  {
    name: "November",
    year: 2026,
    month: 10,
    events: [
      ...range(1, 27, "helper", "Helper trip"),
      { day: 11, category: "school", label: "Parents meet up" },
      ...range(15, 22, "dad", "Dubai"),
      ...[22, 23, 24, 25, 26, 29].map((day) => ({
        day,
        category: "school",
        label: "Autumn break",
      })),
      ...range(28, 30, "dad", "London"),
    ],
    travel: {
      15: "depart",
      22: "arrive",
      27: "arrive",
      28: "depart",
    },
  },
  {
    name: "December",
    year: 2026,
    month: 11,
    events: [
      ...range(1, 5, "dad", "London"),
      { day: 12, category: "mom", label: "DUE" },
      ...range(14, 20, "dad", "Dubai"),
    ],
    travel: {
      5: "arrive",
    },
    due: 12,
  },
];

function range(start, end, category, label) {
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    day: start + index,
    category,
    label,
  }));
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
        .filter((event) => event.day === day)
        .forEach((event) => {
          const item = document.createElement("div");
          item.className = `event event-${event.category}`;
          item.dataset.category = event.category;
          item.textContent = event.label;
          item.title = `${categories[event.category]}: ${event.label}`;
          events.append(item);
        });
      dayCell.append(events);

      if (month.travel[day]) {
        const travel = document.createElement("span");
        travel.className = `travel ${month.travel[day]}`;
        travel.textContent = "✈";
        travel.setAttribute(
          "aria-label",
          month.travel[day] === "depart" ? "Departure" : "Arrival",
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

const calendar = document.querySelector("#calendar");
months.forEach((month) => calendar.append(renderMonth(month)));

let activeFilter = null;
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
