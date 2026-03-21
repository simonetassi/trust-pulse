import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, SlicePipe } from '@angular/common';
import { Subscription, switchMap } from 'rxjs';
import { BackendService } from '../../../common/services/backend.service';
import { SocketService } from '../../../common/services/socket.service';
import { Device, ScoreHistoryEntry } from '../../../common/interfaces';

@Component({
  selector: 'app-device-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, SlicePipe],
  templateUrl: './device-detail.html',
  styleUrl: './device-detail.scss',
})
export class DeviceDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(BackendService);
  private readonly socket = inject(SocketService);
  private readonly subscription = new Subscription();

  public device: Device | null = null;
  public history: ScoreHistoryEntry[] = [];
  public isLoading = true;
  public isHistoryLoading = true;
  public error: string | null = null;

  public ngOnInit(): void {
    const routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        const deviceId = params.get('deviceId')!;
        this.isLoading = true;
        this.isHistoryLoading = true;
        this.error = null;
        return this.backend.getDevice(deviceId);
      })
    ).subscribe({
      next: (device) => {
        this.device = device;
        this.isLoading = false;
        this.loadHistory(device.deviceId);
        this.listenSocketEvents(device.deviceId);
      },
      error: (err) => {
        this.error = 'Device not found.';
        this.isLoading = false;
        console.error('[DeviceDetail] Failed to load device:', err);
      }
    });

    this.subscription.add(routeSub);
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadHistory(deviceId: string): void {
    const sub = this.backend.getHistory(deviceId).subscribe({
      next: (response) => {
        this.history = [...response.history].reverse();
        this.isHistoryLoading = false;
      },
      error: () => {
        this.isHistoryLoading = false;
      },
    });
    this.subscription.add(sub);
  }

  private listenSocketEvents(deviceId: string): void {
    const accuracySub = this.socket.onAccuracyReport().subscribe(event => {
      if (event.deviceId !== deviceId || !this.device) return;

      this.device = {
        ...this.device,
        accuracyScore: event.newAccuracyScore,
        compositeScore: this.computeComposite(
          event.newAccuracyScore,
          this.device.availabilityScore
        ),
        totalReports: this.device.totalReports + 1
      };

      this.history = [{
        type: 'accuracy',
        accurate: event.accurate,
        newScore: event.newAccuracyScore,
        blockNumber: 0,
        txHash: event.txHash
      }, ...this.history];
    });

    const availabilitySub = this.socket.onAvailabilityReport().subscribe(event => {
      if (event.deviceId !== deviceId || !this.device) return;

      this.device = {
        ...this.device,
        availabilityScore: event.newAvailabilityScore,
        compositeScore: this.computeComposite(
          this.device.accuracyScore,
          event.newAvailabilityScore
        ),
        totalReports: this.device.totalReports + 1
      };

      this.history = [{
        type: 'availability',
        online: event.available,
        newScore: event.newAvailabilityScore,
        blockNumber: 0,
        txHash: event.txHash
      }, ...this.history];
    });

    const deactivatedSub = this.socket.onDeviceDeactivated().subscribe(event => {
      if (event.deviceId !== deviceId || !this.device) return;
      this.device = { ...this.device, active: false };
    });

    this.subscription.add(accuracySub);
    this.subscription.add(availabilitySub);
    this.subscription.add(deactivatedSub);
  }

  private computeComposite(accuracy: number, availability: number): number {
    return Math.round((accuracy * 60 + availability * 40) / 100);
  }

  get deviceLabel(): string {
    return this.device?.wotEndpoint.split('/').pop() ?? '';
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