import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Device } from '../../../common/interfaces';
import { ReputationCard } from "./components/reputation-card/reputation-card";
import { BackendService } from '../../../common/services/backend.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard-page',
  imports: [ReputationCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  public readonly backend = inject(BackendService);
  private subscription = new Subscription();

  public devices: Device[] = [];
  public isLoading: boolean = false;
  public error: string | null = null;

  public ngOnInit(): void {
    this.loadDevices();
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadDevices(): void {
    this.isLoading = true;
    this.error = null;

    const sub = this.backend.getOperatorDevices(environment.operatorAddress)
    .subscribe({
      next: (res) => {
        this.devices = res.devices;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Could not load devices. Make sure the backend is running.';
        this.isLoading = false;
        console.error(`[Dashboard] Failed to load devices`, err);
      }
    });

    this.subscription.add(sub);
  }

  public get avgAccuracy(): number {
    if (!this.devices.length) return 0;
    return Math.round(
      this.devices.reduce((sum, d) => sum + d.accuracyScore, 0) / this.devices.length
    );
  }

  public get avgAvailability(): number {
    if (!this.devices.length) return 0;
    return Math.round(
      this.devices.reduce((sum, d) => sum + d.availabilityScore, 0) / this.devices.length
    );
  }

  public get activeCount(): number {
    return this.devices.filter(d => d.active).length;
  }

  public scoreColor(score: number): string {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-danger';
  }

  public trackByDeviceId(_: number, device: Device): string {
    return device.deviceId;
  }
}
