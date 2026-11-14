import { Bomba } from "./bomba.component";

describe("Bomba (TV)", () => {
  it("annuncia la bomba presa e il turno scaduto", () => {
    const tv = new Bomba();

    expect(tv.eventText({ kind: "bomb", player: "Anna", label: "Roma" })).toContain("BOMBA");
    expect(tv.eventText({ kind: "bomb", player: "Anna", label: "Roma" })).toContain("Roma");
    expect(tv.eventText({ kind: "eliminated", player: "Bruno" })).toContain("TEMPO SCADUTO");
    expect(tv.eventText({ kind: "pick", player: "Carla", label: "Milano" })).toContain("Milano");
  });
});
