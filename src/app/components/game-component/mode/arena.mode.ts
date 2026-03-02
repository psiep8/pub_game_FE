import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export interface ArenaTeamProgress {
    playerName: string;
    distance: number; // 0 = center, 100 = outer edge
    eliminated: boolean;
    score: number;
    position?: number;
}

export interface ArenaDisplayData {
    teams: ArenaTeamProgress[];
    circleRadius: number; // 100 to ~20
    eliminatedPlayers: string[];
    gameEnded: boolean;
    winners: string[];
}

export class ArenaMode extends GameModeBase {
    readonly type: GameModeType = 'ARENA';
    readonly timerDuration = 90; // The circle shrinks over 90 seconds
    readonly requiresBubbles = false;
    readonly requiresBuzz = false;

    private teams = signal<Map<string, ArenaTeamProgress>>(new Map());
    private circleRadius = signal<number>(100);
    private eliminatedPlayers = signal<string[]>([]);
    private gameEnded = signal<boolean>(false);
    private winners = signal<string[]>([]);

    // Config parameters for the arena mechanic
    private readonly SHRINK_INTERVAL = 1000; // ms
    private readonly MIN_RADIUS = 20;

    protected onInitialize(): void {
        console.log('🏟️ ARENA MODE inizializzato');
    }

    private initializeTeams() {
        const activePlayers = (this.config as any).activePlayers || [];
        const initialTeams = new Map<string, ArenaTeamProgress>();

        // Rank players based on their current leaderboard position 
        // Wait, the activePlayers array is already sorted by the leaderboard! (from game.component: this.leaderboardService.getLeaderboard().map(p => p.playerName))
        // The higher the rank (index closer to 0), the closer to the center they start.

        activePlayers.forEach((playerName: string, index: number) => {
            // Calculate starting distance based on rank. 
            // 1st place gets distance ~30 (closer to center, but not exactly 0 to allow some movement mechanics)
            // Last place gets distance ~80 (closer to the edge of the circle)
            const rankRatio = activePlayers.length > 1 ? index / (activePlayers.length - 1) : 0.5;
            const initialDistance = 30 + (rankRatio * 50); // 30 to 80

            initialTeams.set(playerName, {
                playerName,
                distance: initialDistance,
                eliminated: false,
                score: 0
            });
        });

        this.teams.set(initialTeams);
        this.circleRadius.set(100);
        this.eliminatedPlayers.set([]);
        this.gameEnded.set(false);
        this.winners.set([]);

        console.log(`🏟️ Team inizializzati nell'arena: ${activePlayers.length} giocatori`);
    }

    protected async onStart(): Promise<void> {
        this.initializeTeams();
        await this.runPreGameSequence(5000); // 5s countdown prima della battaglia
    }

    protected onPause(): void {
        // Non serve pause
    }

    protected onResume(): void {
        // Non serve resume
    }

    protected onStop(): void {
        this.endGame();
    }

    protected onCleanup(): void {
        this.teams.set(new Map());
        this.circleRadius.set(100);
        this.eliminatedPlayers.set([]);
        this.gameEnded.set(false);
        this.winners.set([]);
    }

    protected onTimeout(): void {
        console.log('⏰ Tempo arena scaduto! (Il cerchio è al minimo)');
        this.endGame();
    }

    protected onBuzz(playerName: string): void {
        // Non usato
    }

    protected onAnswer(playerName: string, answer: any, result: any): void {
        // Arena mode answers come through here via the fast-track or standard standard handles
        if (this.gameEnded() || !this.isActive()) return;

        this.updateTeamFromAnswer(playerName, !!result?.isCorrect, result?.points || 0);
    }

    /**
     * Fast track per aggiornamenti diretti come in ScreamRace
     */
    public updateTeamProgress(playerName: string, isCorrect: boolean, points: number = 0) {
        if (this.gameEnded() || !this.isActive()) return;
        this.updateTeamFromAnswer(playerName, isCorrect, points);
    }

    private updateTeamFromAnswer(playerName: string, isCorrect: boolean, roundScore: number) {
        const currentTeams = new Map(this.teams());
        const key = playerName.trim().toLowerCase();

        // Find team
        let teamKey = Array.from(currentTeams.keys()).find(k => k.toLowerCase() === key) || playerName;
        let team = currentTeams.get(teamKey);

        if (team && !team.eliminated) {
            // Movement mechanics:
            // Correct answer: move 15 units towards center (distance decreases)
            // Wrong answer: move 10 units towards edge (distance increases)
            const movement = isCorrect ? -15 : 10;

            team.distance = Math.max(0, Math.min(100, team.distance + movement));
            team.score += roundScore;

            console.log(`%c 🏟️ ARENA MOVE: ${playerName} isCorrect:${isCorrect} -> Distance: ${team.distance.toFixed(1)} `, 'color: #ff9800; font-weight: bold;');

            currentTeams.set(teamKey, team);
            this.teams.set(currentTeams);

            this.checkEliminations();
        }
    }

    protected onConfirmCorrect(result: GameModeResult): void {
        // Not used directly from UI
    }

    protected onConfirmWrong(result: GameModeResult): void {
        // Not used directly from UI
    }

    protected validateAnswer(answer: any, timeMs: number): any {
        // Usually bypassed as Arena remote will send {isCorrect: true/false} 
        // but just in case:
        return { isCorrect: answer?.isCorrect || false };
    }

    protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
        return isCorrect ? +10 : -10; // Micro points for each internal question handled externally
    }

    // We override the startTimer from base class to include the circle shrink mechanic
    protected override startTimer(): void {
        // Need to access parent's timer properties - doing it via proxy
        const anyThis = this as any;

        if (anyThis.timerInterval) clearInterval(anyThis.timerInterval);

        anyThis.timerInterval = setInterval(() => {
            if (this.isPaused() || this.buzzedPlayer()) return;

            const current = this.timer();
            if (current > 0) {
                this.timer.set(current - 1);
                this.config.onTimerTick?.(current - 1);

                // --- ARENA MECHANIC ---
                // Shrink the circle radius proportionally to the time remaining
                // Formula: min + (range) * (timeLeft / (totalTime * delayFactor))
                // We delay shrinking in the first 10% of time
                const timeRatio = current / this.timerDuration;

                // Let's make the circle shrink from 100 to MIN_RADIUS (20)
                let newRadius = 100;

                // Wait 10 seconds before starting to shrink, then shrink linearly to 20
                const shrinkStartRatio = (this.timerDuration - 10) / this.timerDuration;
                if (timeRatio < shrinkStartRatio) {
                    const normalizedRatio = timeRatio / shrinkStartRatio;
                    newRadius = this.MIN_RADIUS + (100 - this.MIN_RADIUS) * normalizedRatio;
                }

                this.circleRadius.set(newRadius);

                // Periodically check who is outside the circle and eliminate them
                this.checkEliminations();

            } else {
                anyThis.stopTimer();
                anyThis.handleTimeout();
            }
        }, 1000); // 1 tick per second
    }

    private checkEliminations() {
        if (this.gameEnded()) return;

        const currentRadius = this.circleRadius();
        const currentTeams = new Map(this.teams());
        const elimPlayers = [...this.eliminatedPlayers()];
        let newlyEliminated = false;

        let activeCount = 0;

        currentTeams.forEach((team, key) => {
            if (!team.eliminated) {
                // Se la distanza del team dal centro è maggiore del raggio del cerchio (con un piccolo buffer), è fuori
                // Team distance is 0-100, where 0 is center and 100 is far edge. 
                // Radius is 20-100.
                // E.g., if radius is 60, anyone with distance > 60 is out!
                const tolerance = 2; // small visual tolerance
                if (team.distance > currentRadius + tolerance) {
                    team.eliminated = true;
                    elimPlayers.push(team.playerName);
                    newlyEliminated = true;
                    console.log(`💀 ARENA ELIMINATION: ${team.playerName} fell outside the circle! (Dist: ${team.distance.toFixed(1)} > Rad: ${currentRadius.toFixed(1)})`);
                } else {
                    activeCount++;
                }
            }
        });

        if (newlyEliminated) {
            this.teams.set(currentTeams);
            this.eliminatedPlayers.set(elimPlayers);

            // Se resta 1 o 0 squadre, fine gara
            if (activeCount <= 1) {
                console.log(`🏆 Gara ARENA conclusa in anticipo per eliminazione di massa! Salvati: ${activeCount}`);
                this.endGame();
            }
        }
    }

    private endGame() {
        if (this.gameEnded()) return;

        this.gameEnded.set(true);

        // Sort players. Un-eliminated players first (closest to center), then eliminated players (longest surviving first)
        const teamsArray = Array.from(this.teams().values());

        // Determine the exact ranking
        // 1. Alive are better than dead
        // 2. If both alive, smaller distance is better
        // 3. If both dead, the one who died LATER is better (which means they are further down the rejected list, or we could just use their distance at death. Distance at death is probably fair enough. Or we can just use the order of eliminatedPlayers array backwards)

        const elimOrder = this.eliminatedPlayers();

        teamsArray.sort((a, b) => {
            if (!a.eliminated && b.eliminated) return -1;
            if (a.eliminated && !b.eliminated) return 1;

            if (!a.eliminated && !b.eliminated) {
                return a.distance - b.distance; // smaller distance is better
            }

            // Both eliminated: whoever was eliminated LATEST is better
            const indexA = elimOrder.indexOf(a.playerName);
            const indexB = elimOrder.indexOf(b.playerName);
            return indexB - indexA; // Higher index (later) comes first
        });

        // Assign definitive positions
        teamsArray.forEach((team, index) => {
            team.position = index + 1;
        });

        this.winners.set(teamsArray.slice(0, 3).map(t => t.playerName));

        // Scoring logic for the arena:
        // This mode grants lots of points to winners and removes points from losers!
        console.log("🏆 ARENA RESULTS:");

        const halfMark = Math.ceil(teamsArray.length / 2);

        teamsArray.forEach((team, index) => {
            let finalPoints = 0;

            if (index === 0) {
                finalPoints += 1000; // First place bonus!
            } else if (index < halfMark) {
                finalPoints += 500; // Top half gains
            } else {
                finalPoints -= 300; // Bottom half loses
            }

            team.score = finalPoints;
            console.log(`${team.position}° - ${team.playerName}: ${finalPoints > 0 ? '+' : ''}${finalPoints} pts (Eliminated: ${team.eliminated})`);

            // Dispatch points right here or rely on the game-component handling? 
            // The game-component expects points to be handled through WS or manual addPoints. 
            // We will rely on game-component firing `RACE_ENDED` and adding points there, or we can use the config.onAnswerReceived to inject the final points
        });

        // We update the teams one last time
        const updatedMap = new Map();
        teamsArray.forEach(t => updatedMap.set(t.playerName, t));
        this.teams.set(updatedMap);

        // Parent components will detect the timer stop or we can trigger it
        if (this.isActive()) this.stop();
    }

    getDisplayData() {
        return {
            teams: Array.from(this.teams().values()),
            circleRadius: this.circleRadius(),
            eliminatedPlayers: this.eliminatedPlayers(),
            gameEnded: this.gameEnded(),
            winners: this.winners()
        };
    }
}
