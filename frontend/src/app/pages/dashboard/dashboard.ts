import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Device } from '../../../common/interfaces';
import { ReputationCard } from "./components/reputation-card/reputation-card";
import { BackendService } from '../../../common/services/backend.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService } from '../../../common/services/socket.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-page',
  imports: [ReputationCard, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  public readonly backend = inject(BackendService);
  public readonly socket = inject(SocketService);
  private subscription = new Subscription();

  public devices: Device[] = [];
  public isLoading: boolean = false;
  public error: string | null = null;
  public isSocketConnected: boolean = false;

  public ngOnInit(): void {
    this.loadDevices();
    this.listenSocketEvents();
    
    const connSub = this.socket.connected$.subscribe(connected => {
      this.isSocketConnected = connected;
    });
    this.subscription.add(connSub);  
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
        this.sortDevices();
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

  private listenSocketEvents(): void {
    const accuracySub = this.socket.onAccuracyReport().subscribe(event => {
      const device = this.devices.find(d => d.deviceId === event.deviceId);
      if (device) {
        device.accuracyScore = event.newAccuracyScore;
        device.compositeScore = this.computeComposite(device.accuracyScore, device.availabilityScore);
        device.totalReports++;
      }
      this.sortDevices();
    });

    const availabilitySub = this.socket.onAvailabilityReport().subscribe(event => {
      const device = this.devices.find(d => d.deviceId === event.deviceId);
      if (device) {
        device.availabilityScore = event.newAvailabilityScore;
        device.compositeScore = this.computeComposite(device.accuracyScore, device.availabilityScore);
      }
      this.sortDevices();
    });

    const deactivatedSub = this.socket.onDeviceDeactivated().subscribe(event => {
      const device = this.devices.find(d => d.deviceId === event.deviceId);
      if (device) {
        device.active = false;
      }
    });

    this.subscription.add(accuracySub);
    this.subscription.add(availabilitySub);
    this.subscription.add(deactivatedSub);
  }

  // TODO transfer this logic to backend??
  private computeComposite(accuracy: number, availability: number): number {
    return Math.round((accuracy * 60 + availability * 40) / 100);
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

  private sortDevices(): void {
    this.devices = [...this.devices].sort(
      (a, b) => b.compositeScore - a.compositeScore
    );
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
