import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WalletService } from '../common/services/wallet.service';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SlicePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public readonly wallet = inject(WalletService);
}
