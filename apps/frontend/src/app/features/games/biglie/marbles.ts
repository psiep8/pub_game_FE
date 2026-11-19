/**
 * Le otto biglie della serata: profilo, colore e faccia.
 *
 * Sta fuori dal componente perché la stessa tabella serve alla TV e alla
 * simulazione headless della corsa.
 */
export interface Marble {
  id: string;
  name: string;
  color: string;
  emoji: string;
  speed: number;
  accel: number;
  grip: number;
}

export const MARBLES: Marble[] = [
  { id: 'fulmine', name: 'FULMINE', color: '#facc15', emoji: '⚡', speed: 10, accel: 6, grip: 3 },
  { id: 'scheggia', name: 'SCHEGGIA', color: '#fb7185', emoji: '🔥', speed: 8, accel: 9, grip: 3 },
  { id: 'chiodo', name: 'CHIODO', color: '#38bdf8', emoji: '🧲', speed: 4, accel: 6, grip: 10 },
  { id: 'piuma', name: 'PIUMA', color: '#a3e635', emoji: '🪶', speed: 6, accel: 10, grip: 5 },
  { id: 'tank', name: 'TANK', color: '#94a3b8', emoji: '🛡️', speed: 5, accel: 5, grip: 9 },
  { id: 'vortice', name: 'VORTICE', color: '#c084fc', emoji: '🌀', speed: 9, accel: 7, grip: 5 },
  { id: 'sasso', name: 'SASSO', color: '#f97316', emoji: '🪨', speed: 6, accel: 5, grip: 8 },
  { id: 'lampo', name: 'LAMPO', color: '#22d3ee', emoji: '💧', speed: 7, accel: 8, grip: 6 },
];
