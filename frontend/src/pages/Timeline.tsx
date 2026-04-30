import { useState } from "react";

const MONTHS = [
  { key: "oct", label: "OCTOBER", short: "OCT", days: [18, 20, 22, 24, 26, 28, 30] },
  { key: "nov", label: "NOVEMBER", short: "NOV", days: [1, 4, 8, 12, 16, 18, 22, 26, 28, 30] },
  { key: "dec", label: "DECEMBER", short: "DEC", days: [1, 4, 8, 12, 15, 19, 23, 26, 28, 29, 31] },
  { key: "jan", label: "JANUARY", short: "JAN", days: [1, 3, 5, 7, 10, 13, 16, 19, 22, 25, 28] },
];

const ALL_COLS = MONTHS.flatMap(m => m.days.map(d => ({ month: m.key, day: d })));
const TOTAL_COLS = ALL_COLS.length;

const TASKS = [
  { id: 1, name: "INITIAL WORKS", isHeader: true },
  { id: 2, name: "Spreading flooring mats", cat: "INITIAL WORKS", start: 0, dur: 4 },
  { id: 3, name: "Demolition", cat: "INITIAL WORKS", start: 0, dur: 2 },
  { id: 4, name: "Cleaning", cat: "INITIAL WORKS", start: 2, dur: 2 },
  { id: 5, name: "New civil works", cat: "INITIAL WORKS", start: 2, dur: 4 },
  { id: 6, name: "Flooring repair works", cat: "INITIAL WORKS", start: 3, dur: 3 },
  { id: 7, name: "FALSE CEILING", isHeader: true },
  { id: 8, name: "Channeling", cat: "FALSE CEILING", start: 2, dur: 4 },
  { id: 9, name: "AC piping, ceiling wiring", cat: "FALSE CEILING", start: 4, dur: 5 },
  { id: 10, name: "Sheeting", cat: "FALSE CEILING", start: 5, dur: 3 },
  { id: 11, name: "Light cutting, light fixing", cat: "FALSE CEILING", start: 7, dur: 3 },
  { id: 12, name: "Electrical chipping", cat: "FALSE CEILING", start: 4, dur: 4 },
  { id: 13, name: "Plumbing / Sanitary", cat: "FALSE CEILING", start: 6, dur: 5 },
  { id: 14, name: "PAINTING", isHeader: true },
  { id: 15, name: "Painting on ceiling", cat: "PAINTING", start: 9, dur: 4 },
  { id: 16, name: "Painting on walls", cat: "PAINTING", start: 11, dur: 5 },
  { id: 17, name: "CARPENTRY", isHeader: true },
  { id: 18, name: "Carpentry works", cat: "CARPENTRY", start: 11, dur: 8 },
  { id: 19, name: "GRANITE", isHeader: true },
  { id: 20, name: "Granite works", cat: "GRANITE", start: 13, dur: 7 },
  { id: 21, name: "TILES", isHeader: true },
  { id: 22, name: "Tiles dado works", cat: "TILES", start: 12, dur: 5 },
  { id: 23, name: "GLASS & MIRROR", isHeader: true },
  { id: 24, name: "Glass / mirror works", cat: "GLASS", start: 17, dur: 4 },
  { id: 25, name: "SANITARY", isHeader: true },
  { id: 26, name: "Sanitary & bath fitments", cat: "SANITARY", start: 17, dur: 4 },
  { id: 27, name: "ELECTRICAL", isHeader: true },
  { id: 28, name: "Lights / Fan fitment", cat: "ELECTRICAL", start: 19, dur: 3 },
  { id: 29, name: "AC fitment", cat: "ELECTRICAL", start: 19, dur: 3 },
  { id: 30, name: "FURNITURE", isHeader: true },
  { id: 31, name: "Loose furniture / artefacts fixing", cat: "FURNITURE", start: 21, dur: 5 },
  { id: 32, name: "DEEP CLEANING", isHeader: true },
  { id: 33, name: "Deep cleaning", cat: "Deep cleaning", start: 26, dur: 2 },
  { id: 34, name: "Curtain rods and curtains", cat: "FINISHING", start: 26, dur: 3 },
  { id: 35, name: "Handover", cat: "HANDOVER", start: 29, dur: 2 },
];

const STATES = [null, "planned", "done", "extended"];
const STATE_COLORS: any = {
  planned: "#A6A6A6", // GREY
  done: "#70AD47",    // GREEN
  extended: "#FF0000", // RED (OVERDUE)
};
const BORDER = "1px solid #000";
export default function Timeline() {
  const [cells, setCells] = useState(() => {
    const initial: any = {};
    TASKS.forEach(t => {
      if (!t.isHeader) {
        initial[t.id] = Array(TOTAL_COLS).fill(0);
        for (let i = t.start!; i < Math.min(t.start! + t.dur!, TOTAL_COLS); i++) {
          initial[t.id][i] = 1; // Default to planned
        }
      }
    });
    return initial;
  });
  function clickCell(taskId: number, col: number) {
    setCells((prev: any) => {
      const row = [...prev[taskId]];
      row[col] = (row[col] + 1) % STATES.length;
      return { ...prev, [taskId]: row };
    });
  }
  return (
    <div style={{ backgroundColor: "#f3f4f6", minHeight: "100vh", padding: "40px", display: "flex", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", padding: "40px", width: "100%", maxWidth: "1200px", border: "1px solid #000", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        {/* Professional Document Header */}
        <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "3px solid #000", paddingBottom: "15px" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.5px", margin: 0 }}>
            TIMELINE FOR INTERIORS WORKS FOR CHEERANJIVI SITE — (YENDADA)
          </h1>
          <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "5px" }}>ARK ARCHITECTS AND INTERIOR DESIGNERS</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", border: "2px solid #000", tableLayout: "fixed" }}>
            <thead>
              {/* Month Header Row */}
              <tr style={{ backgroundColor: "#F2F2F2" }}>
                <th style={{ width: "35px", border: BORDER, fontSize: "0.65rem", padding: "5px" }}>No.</th>
                <th style={{ width: "220px", border: BORDER, fontSize: "0.65rem", padding: "5px", textAlign: "left" }}>Work description</th>
                {MONTHS.map(m => (
                  <th key={m.key} colSpan={m.days.length} style={{ border: BORDER, fontSize: "0.7rem", padding: "5px", textTransform: "uppercase", backgroundColor: "#E2E8F0" }}>
                    {m.label}
                  </th>
                ))}
              </tr>
              {/* Day Header Row */}
              <tr style={{ backgroundColor: "#FFF" }}>
                <th style={{ border: BORDER }}></th>
                <th style={{ border: BORDER, textAlign: "left", paddingLeft: "8px", fontSize: "0.6rem", color: "#666" }}>Dates →</th>
                {ALL_COLS.map((c, i) => (
                  <th key={i} style={{ border: BORDER, padding: "2px", fontSize: "0.6rem", minWidth: "22px", fontWeight: 700 }}>
                    {c.day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                let taskNum = 0;
                let headerIndex = 0;
                return TASKS.map((task) => {
                  if (task.isHeader) {
                    headerIndex++;
                    return (
                      <tr key={`header-${task.id}`} style={{ backgroundColor: "#D9D9D9" }}>
                        <td style={{ border: BORDER, textAlign: "center", fontWeight: 900, fontSize: "0.7rem" }}>{headerIndex}</td>
                        <td colSpan={1 + TOTAL_COLS} style={{ border: BORDER, padding: "4px 8px", fontWeight: 900, fontSize: "0.75rem", textTransform: "uppercase" }}>
                          {task.name}
                        </td>
                      </tr>
                    );
                  }
                  taskNum++;
                  const rowState = cells[task.id];
                  return (
                    <tr key={task.id} style={{ height: "30px" }}>
                      <td style={{ border: BORDER, textAlign: "center", fontSize: "0.65rem", color: "#666" }}></td>
                      <td style={{ border: BORDER, padding: "4px 8px", fontSize: "0.75rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {task.name}
                      </td>
                      {rowState.map((stateIdx: number, col: number) => {
                        const state = STATES[stateIdx];
                        const bg = state ? STATE_COLORS[state] : "transparent";
                        return (
                          <td
                            key={col}
                            onClick={() => clickCell(task.id, col)}
                            style={{
                              border: BORDER,
                              backgroundColor: bg,
                              cursor: "pointer",
                              transition: "background 0.1s",
                            }}
                          ></td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}

              {/* Total Project Time Row */}
              <tr style={{ backgroundColor: "#F2F2F2", height: "35px" }}>
                <td style={{ border: BORDER }}></td>
                <td style={{ border: BORDER, padding: "4px 8px", fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase" }}>
                  Total project time
                </td>
                {ALL_COLS.map((_, i) => (
                  <td key={i} style={{ border: BORDER, backgroundColor: "#F2F2F2" }}></td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend Section */}
        <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "25px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 18, height: 18, backgroundColor: "#70AD47", border: BORDER }}></div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>COMPLETED (GREEN)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 18, height: 18, backgroundColor: "#FF0000", border: BORDER }}></div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>OVERDUE (RED)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 18, height: 18, backgroundColor: "#A6A6A6", border: BORDER }}></div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>PLANNED (GREY)</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.65rem", color: "#999", margin: 0 }}>© ARK ARCHITECTS AND INTERIOR DESIGNERS</p>
            <p style={{ fontSize: "0.6rem", color: "#bbb", margin: 0 }}>Interactive Schedule - Click cells to cycle status</p>
          </div>
        </div>

      </div>
    </div>
  );
}