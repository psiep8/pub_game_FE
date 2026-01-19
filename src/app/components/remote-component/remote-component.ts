import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {WebSocketService} from '../../services/web-socket.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-remote-component',
  imports: [
    FormsModule
  ],
  templateUrl: './remote-component.html',
  styleUrl: './remote-component.scss',
})
export class RemoteComponent implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED'| 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'QUIZ' | 'TRUE_FALSE'| 'MUSIC'|'IMAGE_BLUR'|'CHRONO'>('QUIZ');
  hasAnswered = signal(false);

  ngOnInit(): void {
    this.ws.status$.subscribe(status => {
      if (status.action === 'START_VOTING') {
        this.startTime = Date.now();
        this.hasAnswered.set(false);
        this.questionType.set(status.type);
        this.gameState.set('VOTING');
      }
    });
  }

  setNickname() {
    if (this.tempNickname.trim()) {
      this.nickname.set(this.tempNickname);
      localStorage.setItem('nickname', this.tempNickname);
    }
  }

  sendVote(index: number) {
    const responseTimeMs = Date.now() - this.startTime;

    this.ws.sendAnswer(1, this.nickname()!, index, responseTimeMs);

    this.hasAnswered.set(true);
    this.gameState.set('LOCKED');
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, -1, time); // -1 indica che non c'è ancora una scelta A,B,C,D
    this.gameState.set('LOCKED');
  }

  ngOnDestroy() {
    this.ws.disconnect();
  }

  // Se vuoi un tasto "Esci" nel telecomando
  logout() {
    this.ws.disconnect();
    localStorage.removeItem('nickname');
    location.reload(); // Torna alla schermata di login
  }
}
