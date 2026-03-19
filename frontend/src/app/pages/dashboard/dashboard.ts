import { Component } from '@angular/core';
import { Device } from '../../../common/interfaces';
import { ReputationCard } from "./components/reputation-card/reputation-card";

@Component({
  selector: 'app-dashboard-page',
  imports: [ReputationCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  public devices: Device[] = [];

  public ngOnInit(): void {
    this.devices = [
      {
        deviceId: '0x2b81e0d4b3f3d543f5f6f99360657358ba43699465380609cd451275b48fde40',
        wotEndpoint: 'http://localhost:8081/sensor-01',
        deviceType: 'temperature-humidity-sensor',
        operator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        accuracyScore: 82,
        availabilityScore: 91,
        compositeScore: 85,
        totalReports: 48,
        registeredAt: Date.now(),
        active: true
      },
      {
        deviceId: '0x81b2fedc3384bc55a4e2c1fa1f4845043fc6982cf67749202269f1c845f01cbe',
        wotEndpoint: 'http://localhost:8082/sensor-02',
        deviceType: 'temperature-humidity-sensor',
        operator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        accuracyScore: 54,
        availabilityScore: 78,
        compositeScore: 63,
        totalReports: 31,
        registeredAt: Date.now(),
        active: true
      },
      {
        deviceId: '0xc60f81679e9314b63cc20c8739aa6e5d95a3aaab138c9ca06ab0e71391461187',
        wotEndpoint: 'http://localhost:8083/sensor-03',
        deviceType: 'temperature-humidity-sensor',
        operator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        accuracyScore: 21,
        availabilityScore: 44,
        compositeScore: 30,
        totalReports: 19,
        registeredAt: Date.now(),
        active: true
      }
    ];
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
