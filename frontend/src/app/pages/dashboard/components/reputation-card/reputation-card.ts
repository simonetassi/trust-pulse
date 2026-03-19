import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Device } from '../../../../../common/interfaces';
import { NgClass, SlicePipe } from '@angular/common';

@Component({
  selector: 'app-reputation-card',
  imports: [RouterLink, SlicePipe],
  templateUrl: './reputation-card.html',
  styleUrl: './reputation-card.scss',
})
export class ReputationCard {
  @Input({ required: true }) 
  public device!: Device;

  get deviceLabel(): string {
    return this.device.wotEndpoint.split('/').pop()
      ?? this.device.deviceId.slice(0, 8);
  }

  public scoreColor(score: number): string {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-danger';
  }

  public scoreBarColor(score: number): string {
    if (score >= 70) return 'bg-success';
    if (score >= 40) return 'bg-warning';
    return 'bg-danger';
  }
}
